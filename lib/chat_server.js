var Log                    = require('./util/log'),
    fs                     = require('fs'),
    os                     = require('os'),
    url                    = require('url'),
    serverConfig           = require('./config'),
    RoomManager            = require('./model/room_manager'),
    Session                = require('./model/session'),
    User                   = require('./model/user'),
    DisconnectMessage      = require('./rpc/chatserver_messages/disconnect'),
    RoomRedirectMessage    = require('./rpc/chatserver_messages/room_redirect'),
    redisConnectionManager = require('./model/redis_connection_manager');
    
var logger = Log.getLogger("ChatServer");

function ChatServer(serverId) {
    this.statusUpdateIntervalId = null;
    this.mountPath = null;
    this.mountProtocol = null;
    this.webSocketRouter = null;
    this.userCount = 0;

    this.serverId = serverId;
    this.usersByGuid = {};
    this.roomManager = new RoomManager(this);
    this.roomServerAssignmentsDB = redisConnectionManager.getClient('room_server_assignments');

    // Initialize client message router
    this.messageRouter = new MessageRouter(this, __dirname + "/rpc/chatserver_messages", true);
}

ChatServer.prototype.mount = function(webSocketRouter) {
    this.webSocketRouter = webSocketRouter;
    
    this.mountPath = "/" + this.serverId + "/";
    this.mountProtocol = 'worlize-interact';
    
    this.webSocketRouter.mount(
        this.mountPath,
        this.mountProtocol,
        this.handleWebSocketRequest.bind(this)
    );

    this.addRedisStateInformation();
    this.startRedisStatusUpdates();
    
    logger.info("Worlize ChatServer Ready.");
    logger.info("Handling requests at path '/" + this.serverId + "/', subprotocol 'worlize-interact'");
};

ChatServer.prototype.unmount = function() {
    this.webSocketRouter.unmount(this.mountPath, this.mountProtocol);
    logger.info("Unmounted WebSocket handler for path " + this.mountPath + " and protocol " + this.mountProtocol);
};

ChatServer.prototype.handleWebSocketRequest = function(request) {
    var self = this;
    var parsedUrl = url.parse(request.resource, true);
    var params = parsedUrl.query;
    var sessionId = params['session'];
    var session;
    var user;
    var room;
    var logNotation = '[' + request.remoteAddress + ']{}';
    
    request.on('requestRejected', function() {
        // Log the rejection
        logger.info("Request from " + request.remoteAddress + " rejected.", logNotation);
    });
    
    // TODO: Verify origin of WebSocket request.

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
        logNotation = "[" + request.remoteAddress + "]{" + session.userGuid + "}";
        loadUser();
    });
    
    // If we do get a session...
    function loadUser() {
        // Load the user
        User.load(session.userGuid, session.userName, function(err, result) {
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
        var existingUser = this.usersByGuid[user.guid];
        if (existingUser) {
            // If they are, close the old connection.
            logger.warn("Disconnecting other user with same guid: " + existingUser.guid, logNotation);
            disconnectMessage = new DisconnectMessage();
            disconnectMessage.errorCode = 1003;
            disconnectMessage.errorMessage = "You have logged on from another location.";
            disconnectMessage.send(existingUser);
            existingUser.connection.drop(1000); // 1000 = Normal close code
        }
        
        // Continue to next step
        verifyRoomExists();
    }
    
    function verifyRoomExists() {
        // Next we verify that we actually host the room that is being
        // requested
        roomManager.verifyRoomIsOnThisServer(session.roomGuid, function(err, result) {
            if (err) {
                logger.error("There was an error while checking which interactivity server hosts room " +
                             session.roomGuid + " - " + err, logNotation);
                request.reject(500, "Unable to verify room server");
                return;
            }

            // If the room isn't hosted on this server, accept the
            // connection just long enough to inform the client.
            if (!result) {
                logger.warn("Requested room '" + self.session.roomGuid +
                            "' is not hosted here.  Informing client.", logNotation);
                var connection = request.accept(request.origin);
                var redirectMessage = new RoomRedirectMessage();
                redirectMessage.roomGuid = session.roomGuid;
                redirectMessage.send({
                    // fake a user object.
                    logNotation: logNotation,
                    connection: connection
                });
                connection.close();
                return;
            }
            loadRoom();
        });
    }
    
    // If verification is successful, load the room
    function loadRoom() {
        roomManager.getRoom(function(err, result) {
            if (err) {
                logger.error("Error while loading room " + session.roomGuid +
                             ": " + err, logNotation);
                request.reject(500, "Unable to load requested room");
                return;
            }
            room = result;
            
            // Now that the room is loaded, we have to establish the connection
            // and then finally enter the user into the room.
            establishConnection();
        });
    }

    // All is well, so we accept the connection.
    function establishConnection() {
        var connection = request.accept(request.origin);

        logger.info("WebSocket connection established for user '" + user.userName + "'", logNotation);
        
        user.connection = connection;
        this.usersByGuid[user.guid] = user;
        
        // Increment the server's user count and update this server's score
        // in the Redis sorted set of servers
        self.userCount ++;
        self.roomServerAssignmentsDB.zadd('serverIds', self.userCount, self.serverId, function(err, result) {
            if (err) {
                logger.error("Unable to update the user count for the server in the redis database: " +
                             err.toString(), logNotation);
            }
        });

        // Set up the connection's event handlers
        connection.on('close', self.handleClientClose.bind(self, user));
        connection.on('message', self.handleClientMessage.bind(self, user));
        connection.on('error', self.handleClientError.bind(self, user));
        
        // Finally, enter the user into the room.
        room.addUser(user);
        
        // We're done!  The connection is established!
    }
};

ChatServer.prototype.handleClientMessage = function(user, message) {
    if (message.type === 'utf8') {
        try {
            var decodedMessage = this.messageRouter.decodeMessage(message);
            this.messageRouter.routeMessage(decodedMessage, user);
        }
        catch (e) {
            logger.error("Error while processing incoming message: " + e.toString(), user.logNotation);
        }
        return;
    }
    logger.error("Unhandled WebSocket message type '" + message.type + "' from user " +
                 user.guid + " - " + user.userName + " - closing connection.", user.logNotation);
    connection.drop(1008); // 1008 = Policy Violation
};

ChatServer.prototype.handleClientClose = function(user) {
    logger.info("WebSocket Connection Closed", user.logNotation);
    
    this.userCount --;
    // Update this server's score in the Redis sorted set of servers
    this.roomServerAssignmentsDB.zadd('serverIds', this.userCount, this.serverId, function(err, result) {
        if (err) {
            logger.error("Unable to update the user count for the server in the redis database: " +
                         err.toString(), user.logNotation);
        }
    });

    delete this.usersByGuid[user.guid];
    user.leaveRoom();
};

ChatServer.prototype.handleClientError = function(user, error) {
    logger.error("WebSocket Error: " + error.toString(), user.logNotation)
});

ChatServer.prototype.addRedisStateInformation = function() {
    // Initialize the state for this interactivity server
    this.roomServerAssignmentsDB.zadd('serverIds', 0, this.serverId, function(err, result) {
        if (err) {
            logger.error("Unable to add the current serverid to the sorted set of server ids in redis: " + err.toString());
        }
    });
};

ChatServer.prototype.removeRedisStateInformation = function() {
    this.roomServerAssignmentsDB.del("serverStatus:" + this.serverId, function(err, result) {
        if (err) {
            logger.error("Unable to delete serverStatus data in redis: " + err.toString())
        }
    });
    this.roomServerAssignmentsDB.zrem("serverIds", this.serverId, function(err, result) {
        if (err) {
            logger.error("Unable to remove the current serverid from the sorted set of server ids in redis: " + err.toString());
        }
    });
};

ChatServer.prototype.startRedisStatusUpdates = function() {
    var self = this;
    this.updatePresenceDatabase();
    this.statusUpdateIntervalId = setInterval(
        this.updatePresenceDatabase.bind(this),
        500
    );
};

ChatServer.prototype.stopRedisStatusUpdates = function() {
    if (this.statusUpdateIntervalId) {
        clearInterval(this.statusUpdateIntervalId);
        this.statusUpdateIntervalId = null;
    }
};

ChatServer.prototype.updatePresenceDatabase = function() {
    var obj = {
        server_id: this.serverId,
        port: this.port,
        host: os.hostname(),
        last_checkin: (new Date()).toISOString(),
        user_count: this.userCount
    };
    // This must be updated very frequently to make sure the data is fresh.
    // The key is set to expire in two seconds, and will be refreshed every 0.5 seconds
    this.roomServerAssignmentsDB.setex("serverStatus:" + this.serverId, 2, JSON.stringify(obj), function(err, result) {
        if (err) {
            logger.error("Unable to update serverStatus:" + this.serverId + " key in redis room server database: " + err.toString());
        }
    })
};

module.exports = ChatServer;