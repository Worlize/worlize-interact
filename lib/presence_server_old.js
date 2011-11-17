require('./ext-excerpt');

var util = require('util'),
    spawn = require('child_process').spawn,
    fs = require('fs'),
    os = require('os'),
    MessageRouter = require('./rpc/message_router'),
    MessageEncoder = require('./rpc/message_encoder'),
    serverConfig = require('./config'),
    redisConnectionManager = require('./model/redis_connection_manager'),
    pubsubManager = require('./model/pubsub_manager'),
    Log = require('./util/log'),
    twentyFourHours = 60 * 60 * 24,
    fiveMinutes = 60 * 5;

var logger = Log.getLogger('PresenceServer');

var PresenceServer = function() {
    this.userCount = 0;
    this.sessionCount = 0;
    
    // Whether to log verbose output
    this.debug = false;

    // Keyed by the Socket.IO sessionId Property
    this.clientsAwaitingHandshake = {};
    
    // Keyed by the Socket.IO sessionId Property
    this.connectedClients = {};
    
    // Clients by user guid
    this.connectedClientsByUserGuid = {};
    
    // Initialize DB connections
    this.presenceDB = redisConnectionManager.getClient('presence');
    
    // Load client message handlers
    var presenceMessageHandlers = {};
    fs.readdirSync(__dirname + "/rpc/presence_messages").forEach(function(filename) {
        if (/^\._/.test(filename)) {
            // don't load text editor temp files.
        }
        else {
            var handler = require(__dirname + '/rpc/presence_messages/' + filename)
            presenceMessageHandlers[handler.messageId] = handler;
        }
    });
    
    // Set up the client message router
    this.messageRouter = new MessageRouter(this, presenceMessageHandlers, true);
};

var SESSION_ID_COUNTER = 0;

PresenceServer.prototype = {
    mount: function(webSocketRouter) {
        var s = this;
        this.serverId = serverId;
        this.webSocketRouter = webSocketRouter;
        
        this.mountPath = "/presence/";
        this.mountProtocol = "worlize-presence";
        
        this.webSocketRouter.mount(this.mountPath, this.mountProtocol, function(request) {
            var connection = request.accept(request.origin);
            
            connection.sessionId = ++SESSION_ID_COUNTER;
            logger.info("Presence: Client ID " + connection.sessionId + " connected from " + request.remoteAddress);
            
            connection.send = s.debug ?
                function(data) {
                    logger.debug2("Presence: Sending: " + data);
                    connection.sendUTF(data);
                }
                :
                function(data) {
                    connection.sendUTF(data);
                }
            ;
            
            s.handleClientConnect(connection);
            
            connection.on('message', s.debug ?
                function(message) {
                    logger.debug2("Presence: Received: " + message.utf8Data);
                    s.handleClientMessage(message.utf8Data, connection);
                }
                :
                function(message) {
                    s.handleClientMessage(message.utf8Data, connection);
                }
            );
            connection.on('close', function() {
                s.handleClientDisconnect(connection);
            });
        });

        this.initializeControlChannel();
        this.initializeStatusUpdates();

        logger.info("Worlize Presence Server Ready.")
        logger.info("Handling requests at path '/presence/', subprotocol 'worlize-presence'");
    },
    
    unmount: function() {
        this.webSocketRouter.unmount(this.mountPath, this.mountProtocol);
    },
    
    broadcast: function(message) {
        for (var guid in this.connectedClientsByUserGuid) {
            var client = this.connectedClientsByUserGuid[guid];
            client.sendUTF(message);
        }
    },

    markAsHandshaked: function(client) {
        var self = this;
        var session = client.session;
        var sessionId = client.sessionId;
        var user = session.user;
        delete this.clientsAwaitingHandshake[sessionId];
        this.connectedClients[sessionId] = client;
        this.connectedClientsByUserGuid[user.guid] = client;
        this.userCount ++;

        user.setPresenceStatus('online');
        
        user.subscribeToPubSubChannel();
    },
    
    shutDown: function(callback) {
        var self = this;
        
        this.unmount();
        
        // If nobody is connected just call the callback now.
        if (self.sessionCount === 0) {
            callback();
            return;
        }
        
        function handleUserCloseCallback() {
            if (self.sessionCount === 0) {
                callback();
            }
        }
        
        var client,sessionId;
        for (sessionId in this.connectedClients) {
            client = this.connectedClients[sessionId];
            logger.debug("Closing connected presence connection " + sessionId);
            client.once('close', handleUserCloseCallback);
            client.close();
        }
        for (sessionId in this.clientsAwaitingHandshake) {
            client = this.clientsAwaitingHandshake[sessionId];
            logger.debug("Closing unhandshaked presence connection " + sessionId);
            client.once('close', handleUserCloseCallback);
            client.close();
        }
    },
    
// Private methods

    initializeControlChannel: function() {
        this.controlChannelMessageHandlerCallback = this.handleGlobalBroadcastMessage.bind(this);
        pubsubManager.subscribe("globalBroadcast", this.controlChannelMessageHandlerCallback);
    },
    
    handleGlobalBroadcastMessage: function(message) {
        try {
            this.broadcast(message);
        }
        catch (e) {
            logger.error("Error while broadcasting global message: " + e);
        }
    },
    
    initializeStatusUpdates: function() {
        // Find our hostname to store it in the Redis Presence Server
        var self = this
        this.hostname = os.hostname();
            
        self.updatePresenceDatabase();
        this.statusUpdateIntervalId = setInterval(
            self.updatePresenceDatabase.bind(self),
            500
        );
    },
    
    handleClientConnect: function(client) {
        this.sessionCount ++;
        this.clientsAwaitingHandshake[client.sessionId] = client;
    },
    handleClientDisconnect: function(client) {
        this.sessionCount --;
        if (!client.session) {
            delete this.clientsAwaitingHandshake[client.sessionId];
        }
        else {
            delete this.connectedClients[client.sessionId];
            
            // check to make sure the client session isn't stale before we
            // go about unsubscribing from the user's channel on Redis
            var user = client.session.user;
            if (user && this.connectedClientsByUserGuid[user.guid] === client) {
                user.setPresenceStatus('offline');

                user.unsubscribeFromPubSubChannel();
                
                this.userCount --;
                delete this.connectedClientsByUserGuid[user.guid];
            }
        }
    },
    handleClientMessage: function(message, client) {
        try {
            var decodedMessage = this.messageRouter.decodeMessage(message);

            // If user is not handshaked (session attribute set), then only
            // allow the handshake message.
            if (client.session || (decodedMessage && decodedMessage.msg == 'handshake')) {
                this.messageRouter.routeMessage(decodedMessage, client);
            }
            else {
                logger.warn("Presence: Unhandshaked Client ID " + client.sessionId + " tried to send a message:\n" + util.inspect(decodedMessage));
            }
        }
        catch (e) {
            logger.error("Presence: Error while processing message from Client ID " + client.sessionId + ": " + e);
        }
    },
    updatePresenceDatabase: function() {
        var obj = {
            server_id: this.serverId,
            port: this.port,
            host: this.hostname,
            last_checkin: (new Date()).toISOString(),
            user_count: this.userCount,
            session_count: this.sessionCount
        };
        this.presenceDB.hset("presenceServer", this.serverId, JSON.stringify(obj));
    }
};

module.exports = PresenceServer;