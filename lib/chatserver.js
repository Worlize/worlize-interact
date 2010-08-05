var http = require('http'),
    sys = require('sys'),
    kiwi = require('kiwi'),
    io = require('./vendor/socket.io/lib/socket.io'),
    spawn = require('child_process').spawn,
    MessageRouter = require('./rpc/message_router').MessageRouter,
    serverConfig = require('./config').Config,
    redisConnectionManager = require('./model/redis_connection_manager'),
    clientMessageHandlers = require('./rpc/client/client_message_handlers'),
    controlMessageHandlers = require('./rpc/pubsub/control_message_handlers'),
    UserManager = require('./model/user_manager'),
    RoomManager = require('./model/room_manager'),
    Class = kiwi.require('class').Class;

kiwi.require('ext');

var ChatServer = new Class({
    constructor: function() {
        this.userCount = 0;
        this.sessionCount = 0;
        
        // Keyed by room guid.
        this.rooms = {};
        
        // Keyed by the Socket.IO sessionId Property
        this.clientsAwaitingHandshake = {};
        
        // Keyed by the Socket.IO sessionId Property
        this.connectedClients = {};
        
        this.userManager = new UserManager(this);
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
        
        // Socket.IO uses the "flashsocket" transport to enable the socket
        // policy file server on port 843.  We probably want to host this
        // socket policy file server elsewhere, like on the HAProxy machine.
        if (!serverConfig.hostFlashPolicyServer) {
            this._transports.splice(this._transports.indexOf('flashsocket'),1);
        }
        
    },
    listen: function(port, serverId) {
        this.serverId = serverId;
        this.port = port;
        
        this._http.listen(this.port);

        // Create IO.Socket Listener instance, attach to our http server
        this.listener = io.listen(this._http, {
            resource: this.serverId,
            transports: this._transports,
            origins: serverConfig.originPolicy.allowedOrigin || '*:*'
        });

        this.listener.addListener('clientConnect', this._handleClientConnect.bind(this));
        this.listener.addListener('clientDisconnect', this._handleClientDisconnect.bind(this));
        this.listener.addListener('clientMessage', this._handleClientMessage.bind(this));

        this.pingIntervalId = setInterval(this._pingUsers.bind(this), serverConfig.pingInterval);
        this._initializeControlChannel();
        this._initializeStatusUpdates();
        this._initPresenceInformation();

        sys.log("Worlize ChatServer Ready.")
        sys.log("Server ID: " + this.serverId + "   Port: " + this.port);
    },

    markAsHandshaked: function(client) {
        delete this.clientsAwaitingHandshake[client.sessionId];
        this.connectedClients[client.sessionId] = client;
        this.userCount ++;
        this.presenceDB.sadd('connectedUsers:'+this.serverId, client.session.user.guid);
    },
    
// Private methods

    _initializeControlChannel: function() {
        this.pubsub.subscribeTo("control:" + this.serverId, this._handleControlMessage.bind(this));
    },
    
    _handleControlMessage: function(channel, message, subscriptionPattern) {
        if (message.toString) {
            try {
                message = JSON.parse(message.toString('utf8'));
            }
            catch (e) {
                sys.log("Unable to parse json from control channel.  Message: " + message + "\nException: " + e);
            }
        }
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
                sys.puts("Unable to determine hostname.  You must explicitly provide a hostname");
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
        sys.log("Client ID " + client.sessionId + " connected");
        this.sessionCount ++;
        this.clientsAwaitingHandshake[client.sessionId] = client;
    },
    _handleClientDisconnect: function(client) {
        sys.log("Client ID " + client.sessionId + " disconnected");
        this.sessionCount --;
        if (!client.session) {
            delete this.clientsAwaitingHandshake[client.sessionId];            
        }
        else {
            var user = client.session.user;
            var room = client.session.room;
            if (user && room) {
                room.userLeave(user.guid);
            }
            delete this.connectedClients[client.sessionId];
            if (user.room === room) {
                this.userCount --;
                this.presenceDB.srem('connectedUsers:'+this.serverId, user.guid);
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
            sys.log("Client ID " + client.sessionId + ": " + e);
        }
    },
    _pingUsers: function() {
        this.listener.broadcast({"msg":"ping"});
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
    }
});

exports.ChatServer = ChatServer;