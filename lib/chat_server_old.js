require('./ext-excerpt');

var util = require('util'),
    fs = require('fs'),
    os = require('os'),
    MessageRouter = require('./rpc/message_router'),
    serverConfig = require('./config'),
    redisConnectionManager = require('./model/redis_connection_manager'),
    RoomManager = require('./model/room_manager'),

var ChatServer = function(serverId) {
    this.serverId = serverId;
    
    this.userCount = 0;
    this.sessionCount = 0;
    
    // Whether to log verbose output
    this.debug = false;

    // Keyed by the sessionId Property
    this.clientsAwaitingHandshake = {};
    
    // Keyed by the sessionId Property
    this.connectedClients = {};
    
    // Clients by user guid
    this.connectedClientsByUserGuid = {};
    
    this.roomManager = new RoomManager(this);
    
    // Initialize DB connections
    this.roomServerAssignmentsDB = redisConnectionManager.getClient('room_server_assignments');
    
    // Initialize Hostname
    this.hostname = os.hostname();
    
    this.initializeClientMessageRouter();
    this.initializeControlMessageRouter();
};

var SESSION_ID_COUNTER = 0;

ChatServer.prototype = {
    mount: function(webSocketRouter) {
        var s = this;
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
        
        console.log("Worlize ChatServer Ready.");
        console.log("Handling requests at path '/" + this.serverId + "/', subprotocol 'worlize-interact'");
    },
    
    unmount: function() {
        this.webSocketRouter.unmount(this.mountPath, this.mountProtocol);
    },
    
    shutDown: function(callback) {
        var self = this;
        this.stopRedisStatusUpdates();
        this.removeRedisStateInformation();
        this.unmount();
        this.disconnectAllUsers(callback);
    },
    
    disconnectAllUsers: function(callback) {
        var self = this;
        var client;
        var sessionId;
        
        // If nobody is connected just call the callback now.
        if (self.sessionCount === 0) {
            callback(null);
            return;
        }
        
        function handleUserCloseCallback() {
            if (self.sessionCount === 0) {
                callback(null);
            }
        }
        
        for (sessionId in this.connectedClients) {
            client = this.connectedClients[sessionId];
            console.log("Closing connection " + sessionId);
            client.once('close', handleUserCloseCallback);
            client.close();
        }
        for (sessionId in this.clientsAwaitingHandshake) {
            client = this.clientsAwaitingHandshake[sessionId];
            console.log("Closing unhandshaked room connection " + sessionId);
            client.once('close', handleUserCloseCallback);
            client.close();
        }
    },
    
    initializeClientMessageRouter: function() {
        // Load client message handlers
        var clientMessageHandlers = {};
        fs.readdirSync(__dirname + "/rpc/chatserver_messages").forEach(function(filename) {
            if (/^\._/.test(filename)) {
                // don't load text editor temp files.
                return;
            }
            var handler = require(__dirname + '/rpc/chatserver_messages/' + filename)
            clientMessageHandlers[handler.messageId] = handler;
        });

        // Set up the client message router
        this.messageRouter = new MessageRouter(this, clientMessageHandlers, true);
    },
    
    initializeControlMessageRouter: function() {
        // Load control message handlers
        var controlMessageHandlers = {};
        fs.readdirSync(__dirname + "/rpc/chatserver_control_messages").forEach(function(filename) {
            if (/^\._/.test(filename)) {
                // don't load text editor temp files.
                return;
            }
            var handler = require(__dirname + '/rpc/chatserver_control_messages/' + filename)
            controlMessageHandlers[handler.messageId] = handler;
        });

        // Set up the control channel message router
        this.controlMessageRouter = new MessageRouter(this, controlMessageHandlers, false);
    },
    
    startRedisStatusUpdates: function() {
        var self = this;
        this.updatePresenceDatabase();
        this.statusUpdateIntervalId = setInterval(
            this.updatePresenceDatabase.bind(this),
            500
        );
    },
    
    stopRedisStatusUpdates: function() {
        if (this.statusUpdateIntervalId) {
            clearInterval(this.statusUpdateIntervalId);
            this.statusUpdateIntervalId = null;
        }
    },
    
    addRedisStateInformation: function() {
        // Initialize the state for this interactivity server
        this.roomServerAssignmentsDB.zadd('serverIds', 0, this.serverId);
    },
    
    removeRedisStateInformation: function() {
        this.roomServerAssignmentsDB.del("serverStatus:" + this.serverId);
        this.roomServerAssignmentsDB.zrem("serverIds", this.serverId);
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
        // This must be updated very frequently to make sure the data is fresh.
        // The key is set to expire in two seconds, and will be refreshed every 0.5 seconds
        this.roomServerAssignmentsDB.setex("serverStatus:" + this.serverId, 2, JSON.stringify(obj))
    },    
    
    handleWebSocketRequest: function(request) {
        var self = this;
        var connection = request.accept(request.origin);
        connection.sessionId = ++SESSION_ID_COUNTER;

        console.log("Client ID " + connection.sessionId + " connected from " + request.remoteAddress);
        
        // var originalSend = connection.send;
        // connection.send = function(data) {
        //     console.log("Sending: " + data);
        //     originalSend.call(connection, data);
        // };
        
        this.handleClientConnect(connection);
        
        connection.on('message', function(message) {
            if (message.type === 'utf8') {
                self.handleClientMessage(message.utf8Data, connection);
                return;
            }
            console.log("Unhandled WebSocket message type: " + message.type);
        });
        connection.on('close', function() {
            self.handleClientDisconnect(connection);
        });        
    },
    
    broadcast: function(message) {
        for (var guid in this.connectedClientsByUserGuid) {
            this.connectedClientsByUserGuid[guid].send(message);
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
    },
    
    handleControlMessage: function(channel, message, subscriptionPattern) {
        try {
            this.controlMessageRouter.routeMessage(this.controlMessageRouter.decodeMessage(message));
        }
        catch (e) {
            console.log("Control Channel: " + e);
        }
    },
    
    handleClientConnect: function(client) {
        this.sessionCount ++;
        // Update this server's score in the Redis sorted set of servers
        this.roomServerAssignmentsDB.zadd('serverIds', this.sessionCount, this.serverId);
        this.clientsAwaitingHandshake[client.sessionId] = client;
    },
    
    handleClientDisconnect: function(client) {
        this.sessionCount --;
        // Update this server's score in the Redis sorted set of servers
        this.roomServerAssignmentsDB.zadd('serverIds', this.sessionCount, this.serverId);
        if (!client.session) {
            delete this.clientsAwaitingHandshake[client.sessionId];
        }
        else {
            delete this.connectedClients[client.sessionId];
            
            // check to make sure the client session isn't stale before we
            // go about ejecting people from rooms...
            var user = client.session.user;
            if (user && this.connectedClientsByUserGuid[user.guid] === client) {

                var room = client.session.room;
                if (room) {
                    room.userLeave(user.guid);
                }

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
                console.log("Unhandshaked Client ID " + client.sessionId + " tried to send a message:\n" + util.inspect(decodedMessage));
            }
        }
        catch (e) {
            console.log("Error while processing message from Client ID " + client.sessionId + ": " + e);
        }
    }
};

module.exports = ChatServer;