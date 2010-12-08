require('./ext-excerpt');

var http = require('http'),
    sys = require('sys'),
    io = require('./vendor/socket.io'),
    spawn = require('child_process').spawn,
    MessageRouter = require('./rpc/message_router'),
    serverConfig = require('./config'),
    redisConnectionManager = require('./model/redis_connection_manager'),
    clientMessageHandlers = require('./rpc/client/client_message_handlers'),
    controlMessageHandlers = require('./rpc/pubsub/control_message_handlers'),
    RoomManager = require('./model/room_manager');

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
        sys.log("Request for url " + req.url);
        res.writeHead(200, {'Content-Type': 'text/plain'});
        res.write("Nothing to see here.  Move along.\n");
        res.end();
    });
    
    this._transports = serverConfig.hasOwnProperty('supportedTransports') ?
                         serverConfig.supportedTransports :
                         ['websocket', 'flashsocket', 'htmlfile', 'xhr-multipart', 'xhr-polling'];

};
ChatServer.prototype = {
    listen: function(port, serverId) {
        this.serverId = serverId;
        this.port = port;
        
        this._http.listen(this.port);

        // Create IO.Socket Listener instance, attach to our http server
        this.listener = io.listen(this._http, {
            resource: this.serverId,
            transports: this._transports,
            transportOptions: serverConfig.transportOptions,
            origins: serverConfig.originPolicy.allowedOrigin || '*:*'
        });

        this.listener.on('clientConnect', this._handleClientConnect.bind(this));
        this.listener.on('clientDisconnect', this._handleClientDisconnect.bind(this));
        this.listener.on('clientMessage', this._handleClientMessage.bind(this));

        this._initializeControlChannel();
        this._initializeStatusUpdates();
        this._initPresenceInformation();

        sys.log("Worlize ChatServer Ready.")
        sys.log("Server ID: " + this.serverId + "   Port: " + this.port);
    },

    markAsHandshaked: function(client) {
        delete this.clientsAwaitingHandshake[client.sessionId];
        this.connectedClients[client.sessionId] = client;
        this.connectedClientsByUserGuid[client.session.user.guid] = client;
        this.userCount ++;
        this.presenceDB.sadd('connectedUsers:'+this.serverId, client.session.user.guid);
    },
    
// Private methods

    _initializeControlChannel: function() {
        this.pubsub.subscribeTo("control:" + this.serverId, this._handleControlMessage.bind(this));
    },
    
    _handleControlMessage: function(channel, message, subscriptionPattern) {
        try {
            this.controlMessageRouter.routeMessage(this.controlMessageRouter.decodeMessage(message));
        }
        catch (e) {
            sys.log("Control Channel: " + e);
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
                sys.log("Unhandshaked Client ID " + client.sessionId + " tried to send a message:\n" + sys.inspect(decodedMessage));
            }
        }
        catch (e) {
            sys.log("Error while processing message from Client ID " + client.sessionId + ": " + e);
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