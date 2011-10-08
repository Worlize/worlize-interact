require('./ext-excerpt');

var util = require('util'),
    spawn = require('child_process').spawn,
    fs = require('fs'),
    MessageRouter = require('./rpc/message_router'),
    serverConfig = require('./config'),
    redisConnectionManager = require('./model/redis_connection_manager'),
    RoomManager = require('./model/room_manager'),
    twentyFourHours = 60 * 60 * 24;

var ChatServer = function() {
    this.userCount = 0;
    this.sessionCount = 0;
    
    // Whether to log verbose output
    this.debug = false;

    // Keyed by room guid.
    this.rooms = {};
    
    // Keyed by the Socket.IO sessionId Property
    this.clientsAwaitingHandshake = {};
    
    // Keyed by the Socket.IO sessionId Property
    this.connectedClients = {};
    
    // Clients by user guid
    this.connectedClientsByUserGuid = {};
    
    this.roomManager = new RoomManager(this);
    
    // Initialize DB connections
    this.presenceDB = redisConnectionManager.getClient('presence');
    
    // Load client message handlers
    var clientMessageHandlers = {};
    fs.readdirSync(__dirname + "/rpc/chatserver_messages").forEach(function(filename) {
        if (/^\._/.test(filename)) {
            // don't load text editor temp files.
        }
        else {
            var handler = require(__dirname + '/rpc/chatserver_messages/' + filename)
            clientMessageHandlers[handler.messageId] = handler;
        }
    });
    
    // Set up the client message router
    this.messageRouter = new MessageRouter(this, clientMessageHandlers, true);

    // Load control message handlers
    var controlMessageHandlers = {};
    fs.readdirSync(__dirname + "/rpc/chatserver_control_messages").forEach(function(filename) {
        if (/^\._/.test(filename)) {
            // don't load text editor temp files.
        }
        else {
            var handler = require(__dirname + '/rpc/chatserver_control_messages/' + filename)
            controlMessageHandlers[handler.messageId] = handler;
        }
    });

    // Set up the control channel message router
    this.controlMessageRouter = new MessageRouter(this, controlMessageHandlers, false);
};

var SESSION_ID_COUNTER = 0;

ChatServer.prototype = {
    mount: function(webSocketRouter, serverId) {
        var s = this;
        this.serverId = serverId;
        this.webSocketRouter = webSocketRouter;
        
        this.webSocketRouter.mount("/" + serverId + "/", 'worlize-interact', function(request) {
            var connection = request.accept(request.origin);
            
            connection.sessionId = ++SESSION_ID_COUNTER;
            console.log("Client ID " + connection.sessionId + " connected from " + request.remoteAddress);
            
            connection.send = s.debug ?
                function(data) {
                    console.log("Sending: " + data);
                    connection.sendUTF(data);
                }
                :
                function(data) {
                    connection.sendUTF(data);
                }
            ;
            
            s._handleClientConnect(connection);
            
            connection.on('message', s.debug ?
                function(message) {
                    console.log("Received: " + message.utf8Data);
                    s._handleClientMessage(message.utf8Data, connection);
                }
                :
                function(message) {
                    s._handleClientMessage(message.utf8Data, connection);
                }
            );
            connection.on('close', function() {
                s._handleClientDisconnect(connection);
            });
        });

        this._initializeStatusUpdates();
        this._initPresenceInformation();

        console.log("Worlize ChatServer Ready.")
        console.log("Handling requests at path '/" + serverId + "/', subprotocol 'worlize-interact'");
    },
    
    broadcast: function(message) {
        for (var guid in this.connectedClientsByUserGuid) {
            var client = this.connectedClientsByUserGuid[guid];
            client.send(message);
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
        
        // Add user to list of connect users on this server
        this.presenceDB.sadd('connectedUsers:'+this.serverId, user.guid);
        // Keep track of which server the user was last connected to
        this.presenceDB.setex('interactServerForUser:'+user.guid, twentyFourHours, this.serverId);
    },
    
// Private methods

    _handleControlMessage: function(channel, message, subscriptionPattern) {
        try {
            this.controlMessageRouter.routeMessage(this.controlMessageRouter.decodeMessage(message));
        }
        catch (e) {
            console.log("Control Channel: " + e);
        }
    },
    
    _initializeStatusUpdates: function() {
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
            self._updatePresenceDatabase();
            this.statusUpdateIntervalId = setInterval(
                self._updatePresenceDatabase.bind(self),
                serverConfig.updatePresenceInterval
            );
        });
    },
    
    _handleClientConnect: function(client) {
        this.sessionCount ++;
        this.clientsAwaitingHandshake[client.sessionId] = client;
    },
    _handleClientDisconnect: function(client) {
        this.sessionCount --;
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
                this.presenceDB.srem('connectedUsers:'+this.serverId, user.guid);
                delete this.connectedClientsByUserGuid[user.guid];
            }
        }
    },
    _handleClientMessage: function(message, client) {
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
    },
    _updatePresenceDatabase: function() {
        var obj = {
            server_id: this.serverId,
            port: this.port,
            host: this.hostname,
            last_checkin: (new Date()).toISOString(),
            user_count: this.userCount,
            session_count: this.sessionCount
        };
        this.presenceDB.hset("interactServer", this.serverId, JSON.stringify(obj));
    },
    _initPresenceInformation: function() {
        this.presenceDB.del('roomsOnServer:'+this.serverId);
        this.presenceDB.del('connectedUsers:'+this.serverId);
    }
};

module.exports = ChatServer;