require('./ext-excerpt');

var http = require('http'),
    util = require('util'),
    spawn = require('child_process').spawn,
    WebSocketServer = require('./vendor/websocket-node/lib/WebSocketServer'),
    WebSocketRouter = require('./vendor/websocket-node/lib/WebSocketRouter'),
    MessageRouter = require('./rpc/message_router'),
    serverConfig = require('./config'),
    redisConnectionManager = require('./model/redis_connection_manager'),
    clientMessageHandlers = require('./rpc/client/client_message_handlers'),
    controlMessageHandlers = require('./rpc/pubsub/control_message_handlers'),
    RoomManager = require('./model/room_manager'),
    twentyFourHours = 60 * 60 * 24;

var ChatServer = function() {
    this.userCount = 0;
    this.sessionCount = 0;
    
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
    this.pubsub = redisConnectionManager.getClient('pubsub');
    
    // Set up the client message router
    this.messageRouter = new MessageRouter(this, clientMessageHandlers);

    // Set up the control channel message router
    this.controlMessageRouter = new MessageRouter(this, controlMessageHandlers);
    
    // Initialize basic http server that IO.Socket will piggyback on
    this._http = http.createServer(function(req, res) {
        console.log("Request for url " + req.url);
        res.writeHead(200, {'Content-Type': 'text/plain'});
        res.write("Nothing to see here.  Move along.\n");
        res.end();
    });
    
};

var SESSION_ID_COUNTER = 0;

ChatServer.prototype = {
    listen: function(port, serverId) {
        var s = this;
        this.serverId = serverId;
        this.port = port;
        
        this._http.listen(this.port);
        
        this.webSocketServer = new WebSocketServer({
            // config options...
            httpServer: this._http
        });
        
        this.webSocketRouter = new WebSocketRouter();
        this.webSocketRouter.attachServer(this.webSocketServer);
        
        this.webSocketRouter.mount('*', 'worlize-interact', function(request) {
            var connection = request.accept(request.origin);
            
            console.log("Client connected from " + request.remoteAddress);
            
            // hacks to be API compatible with Socket.IO
            connection.sessionId = ++SESSION_ID_COUNTER;
            connection.send = connection.sendUTF;
            
            s._handleClientConnect(connection);
            
            connection.on('message', function(message) {
                s._handleClientMessage(message.utf8Data, connection);
            });
            connection.on('close', function() {
                s._handleClientDisconnect(connection);
            });
        });

        this._initializeControlChannel();
        this._initializeStatusUpdates();
        this._initPresenceInformation();

        console.log("Worlize ChatServer Ready.")
        console.log("Server ID: " + this.serverId + "   Port: " + this.port);
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
        this.presenceDB.set('interactServerForUser:'+user.guid, this.serverId, function(err, result) {
          self.presenceDB.expire('interactServerForUser:'+user.guid, twentyFourHours);
        });
        
        // Subscribe to pubsub events aimed at the user guid
        this.pubsub.subscribeTo("user:" + user.guid, function(channel, message) {
            try {
                message = message.toString('utf8');
            }
            catch (e) { /* do nothing */ }
            user.handlePubSubMessage.call(user, channel, message);
        });
    },
    
// Private methods

    _initializeControlChannel: function() {
        this.pubsub.subscribeTo("control:" + this.serverId, this._handleControlMessage.bind(this));
        this.pubsub.subscribeTo("globalBroadcast", this._handleGlobalBroadcastMessage.bind(this));
    },
    
    _handleGlobalBroadcastMessage: function(channel, message) {
        try {
            this.listener.broadcast(message);
        }
        catch (e) {
            console.log("Error while broadcasting global message: " + e);
        }

    },
    
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

                this.pubsub.unsubscribeFrom("user:"+user.guid);
            
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

exports.ChatServer = ChatServer;