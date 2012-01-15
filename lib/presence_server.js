var util                    = require('util'),
    os                      = require('os'),
    url                     = require('url'),
    PresenceUser            = require('./model/presence_user'),
    Session                 = require('./model/session'),
    MessageRouter           = require('./rpc/message_router'),
    MessageEncoder          = require('./rpc/message_encoder'),
    DisconnectMessage       = require('./rpc/presence_messages/disconnect'),
    serverConfig            = require('./config'),
    redisConnectionManager  = require('./model/redis_connection_manager'),
    pubsubManager           = require('./model/pubsub_manager'),
    Log                     = require('./util/log');
    
var twentyFourHours = 60 * 60 * 24,
    fiveMinutes = 60 * 5;

var logger = Log.getLogger('PresenceServer');

var PresenceServer = function(serverId) {
    this.mountPath = null;
    this.mountProtocol = null;
    this.webSocketRouter = null;
    this.userCount = 0;
    this.hostname = os.hostname();
    
    this.serverId = serverId;
    this.usersByGuid = {};
    this.presenceDB = redisConnectionManager.getClient('presence');
    
    // Set up the client message router
    this.messageRouter = new MessageRouter(this, __dirname + "/rpc/presence_messages", true);
};

PresenceServer.prototype.mount = function(webSocketRouter, serverId) {
    this.webSocketRouter = webSocketRouter;
    
    this.mountPath = "/presence/";
    this.mountProtocol = "worlize-presence";
    
    this.webSocketRouter.mount(
        this.mountPath,
        this.mountProtocol,
        this.handleWebSocketRequest.bind(this)
    );

    this.initializeControlChannel();
    this.initializeStatusUpdates();
    this.initializeUserCountLogging();

    logger.info("Worlize Presence Server Ready.")
    logger.info("Handling requests at path '" + this.mountPath + "', subprotocol '" + this.mountProtocol + "'");
};

PresenceServer.prototype.unmount = function() {
    this.webSocketRouter.unmount(this.mountPath, this.mountProtocol);
    logger.info("Unmounted WebSocket handler for path " + this.mountPath + " and protocol " + this.mountProtocol);
};

PresenceServer.prototype.shutDown = function(callback) {
    var self = this;
    logger.info("Initiating ShutDown");
    
    this.unmount();
    clearInterval(this.logUserCountIntervalId);
    clearInterval(this.statusUpdateIntervalId);
    this.disconnectAllUsers(callback);
};

PresenceServer.prototype.disconnectAllUsers = function(callback) {
    var self = this;
    
    var guids = Object.keys(this.usersByGuid);
    if (guids.length !== this.userCount) {
        logger.error("userCount (" + this.userCount + ") does not match " +
                     "number of entries in usersByGuid (" + guids.length +
                     "). Setting userCount to match.");
        this.userCount = guids.length;
    }
    
    // If nobody is connected just call the callback now.
    if (this.userCount === 0) {
        logger.info("No WebSocket connections active, so shutting down immediately.");
        logger.info("ShutDown Complete");
        callback(null);
        return;
    }

    function handleUserCloseCallback() {
        if (self.userCount === 0) {
            logger.info("ShutDown Complete");
            callback(null);
        }
    }
    
    var disconnectMessage = new DisconnectMessage(this);
    disconnectMessage.errorCode = 1005;
    disconnectMessage.errorMessage = "Server is shutting down.";
    
    for (var i=0,len=guids.length; i < len; i++) {
        var guid = guids[i];
        var user = this.usersByGuid[guid];
        user.connection.once('close', handleUserCloseCallback);
        user.sendMessage(disconnectMessage);
        user.connection.drop(1000); // 1000 = Normal close
    }
};

PresenceServer.prototype.handleWebSocketRequest = function(request) {
    var self = this;
    var parsedUrl = url.parse(request.resource, true);
    var params = parsedUrl.query;
    var sessionId = params['session'];
    var session;
    var user;
    var logNotation = {
        ip: request.remoteAddress
    };
    
    // TODO: Verify origin of WebSocket request.
    
    logger.info("action=websocket_request WebSocket Request from " + request.remoteAddress + " origin: " + request.origin);

    request.on('requestRejected', function() {
        // Log the rejection
        logger.info("Request from " + request.remoteAddress + " rejected.", logNotation);
    });
    
    // Make sure the client provided a session guid
    if (typeof(sessionId) !== 'string') {
        request.reject(500);
        return;
    }
    
    // Look up the user's session in the db...
    Session.load(sessionId.toLowerCase(), function(err, result) {
        if (err) {
            // And if we can't find it, disconnect them.
            logger.error("Unable to load session " + sessionId + ": " + err.toString(), logNotation);
            request.reject(404, "Cannot load session");
            return;
        }
        session = result;
        logNotation.user = session.userGuid;
        loadUser();
    });
    
    // If we do get a session...
    function loadUser() {
        // Load the user
        PresenceUser.load(session.userGuid, session.userName, function(err, result) {
            if (err) {
                // If we can't load the user, drop the connection.
                logger.error("Unable to load user: " + err.toString(), logNotation);
                request.reject(404, "Cannot load user");
                return;
            }
            user = result;

            // Keep the logNotation around as part of the user object so that we
            // can pass it to the logger whenever it's available to make parsing
            // the logs for user sessions more feasible.
            user.logNotation = logNotation;
            
            // Stash a reference to the session in the user object
            user.session = session;
            checkForDuplicateConnections();
        });
    }

    // If we do get the user...
    function checkForDuplicateConnections() {
        // ... check to make sure the user isn't already connected
        var existingUser = self.usersByGuid[user.guid];
        if (existingUser) {
            // If they are, close the old connection.
            logger.warn("action=disconnecting_dup Disconnecting other user with same guid: " + existingUser.guid, logNotation);
            disconnectMessage = new DisconnectMessage();
            disconnectMessage.errorCode = 1003;
            disconnectMessage.errorMessage = "You have logged on from another location.";
            disconnectMessage.send(existingUser);
            existingUser.connection.drop(1000); // 1000 = Normal close code
        }
        
        // Continue to next step
        establishConnection();
    }
    
    // All is well, so we accept the connection.
    function establishConnection() {
        var connection = request.accept(request.origin);
        connection.acceptedAt = (new Date()).valueOf();

        logger.info("action=connection_accept WebSocket connection established for user '" + user.userName + "'", logNotation);
        
        user.connection = connection;
        self.usersByGuid[user.guid] = user;
        
        self.userCount ++;
        
        user.initializeDurationRecording();
        user.setPresenceStatus('online');
        user.subscribeToPubSubChannel();

        // Set up the connection's event handlers
        connection.on('close', self.handleClientClose.bind(self, user));
        connection.on('message', self.handleClientMessage.bind(self, user));
        connection.on('error', self.handleClientError.bind(self, user));
        
        // We're done!  The connection is established!
    }
};

PresenceServer.prototype.handleClientMessage = function(user, message) {
    if (message.type === 'utf8') {
        try {
            var decodedMessage = this.messageRouter.decodeMessage(message.utf8Data);
            this.messageRouter.routeMessage(decodedMessage, user);
        }
        catch (e) {
            logger.error("Error while processing incoming message: " + e.toString() +
                         " - Message: " + message.utf8Data, user.logNotation);
        }
        return;
    }
    logger.error("Unhandled WebSocket message type '" + message.type + "' from user " +
                 user.guid + " - " + user.userName + " - closing connection.", user.logNotation);
    connection.drop(1008); // 1008 = Policy Violation
};

PresenceServer.prototype.handleClientClose = function(user) {
    var duration = Math.round(((new Date()).valueOf() - user.connection.acceptedAt) / 1000);
    logger.info("WebSocket Connection Closed. action=connection_close duration=" + duration, user.logNotation);

    user.setPresenceStatus('offline');
    user.destroy();

    this.userCount --;
    delete this.usersByGuid[user.guid];
};

PresenceServer.prototype.handleClientError = function(user, error) {
    logger.error("action=websocket_error WebSocket Error: " + error.toString(), user.logNotation)
};

PresenceServer.prototype.handleGlobalBroadcastMessage = function(message) {
    this.broadcast(message);
};

PresenceServer.prototype.broadcast = function(message) {
    for (var guid in this.usersByGuid) {
        var user = this.usersByGuid[guid];
        user.connection.send(message);
    }
};

PresenceServer.prototype.initializeControlChannel = function() {
    pubsubManager.subscribe("globalBroadcast", this.handleGlobalBroadcastMessage.bind(this));
};

PresenceServer.prototype.initializeStatusUpdates = function() {
    this.updatePresenceDatabase();
    this.statusUpdateIntervalId = setInterval(
        this.updatePresenceDatabase.bind(this),
        500
    );
};

PresenceServer.prototype.initializeUserCountLogging = function() {
    this.logUserCount();
    this.logUserCountIntervalId = setInterval(
        this.logUserCount.bind(this),
        60000
    );
};

PresenceServer.prototype.logUserCount = function() {
    var guids = Object.keys(this.usersByGuid);
    if (guids.length !== this.userCount) {
        logger.error("userCount (" + this.userCount + ") does not match " +
                     "number of entries in usersByGuid (" + guids.length +
                     "). Setting userCount to match.");
        this.userCount = guids.length;
    }
    logger.info("action=log_user_count user_count=" + this.userCount);
};

PresenceServer.prototype.updatePresenceDatabase = function() {
    var obj = {
        server_id: this.serverId,
        port: this.port,
        host: this.hostname,
        last_checkin: (new Date()).toISOString(),
        user_count: this.userCount
    };
    this.presenceDB.hset("presenceServer", this.serverId, JSON.stringify(obj));
};


module.exports = PresenceServer;