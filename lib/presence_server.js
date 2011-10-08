require('./ext-excerpt');

var util = require('util'),
    spawn = require('child_process').spawn,
    fs = require('fs'),
    MessageRouter = require('./rpc/message_router'),
    MessageEncoder = require('./rpc/message_encoder'),
    serverConfig = require('./config'),
    redisConnectionManager = require('./model/redis_connection_manager'),
    pubsubManager = require('./model/pubsub_manager'),
    twentyFourHours = 60 * 60 * 24,
    fiveMinutes = 60 * 5;

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
    mount: function(webSocketRouter, serverId) {
        var s = this;
        this.serverId = serverId;
        this.webSocketRouter = webSocketRouter;
        
        this.webSocketRouter.mount("/presence/", 'worlize-presence', function(request) {
            var connection = request.accept(request.origin);
            
            connection.sessionId = ++SESSION_ID_COUNTER;
            console.log("Presence: Client ID " + connection.sessionId + " connected from " + request.remoteAddress);
            
            connection.send = s.debug ?
                function(data) {
                    console.log("Presence: Sending: " + data);
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
                    console.log("Presence: Received: " + message.utf8Data);
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

        console.log("Worlize Presence Server Ready.")
        console.log("Handling requests at path '/presence/', subprotocol 'worlize-presence'");
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
            console.log("Error while broadcasting global message: " + e);
        }
    },
    
    initializeStatusUpdates: function() {
        // Find our hostname to store it in the Redis Presence Server
        var self = this,
            cmd = spawn('hostname'),
            hostname = "";
            
        cmd.stdout.addListener('data', function(data) {
            hostname = data;
        });
        
        cmd.addListener('exit', function(code) {
            self.hostname = hostname.toString().trim();
            if (code !== 0) {
                console.log("Unable to determine hostname.  You must explicitly provide a hostname");
                process.exit(1);
            }
            self.updatePresenceDatabase();
            this.statusUpdateIntervalId = setInterval(
                self.updatePresenceDatabase.bind(self),
                serverConfig.updatePresenceInterval
            );
        });
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
                console.log("Presence: Unhandshaked Client ID " + client.sessionId + " tried to send a message:\n" + util.inspect(decodedMessage));
            }
        }
        catch (e) {
            console.log("Presence: Error while processing message from Client ID " + client.sessionId + ": " + e);
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