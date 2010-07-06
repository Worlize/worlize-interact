var http = require('http'),
    sys = require('sys'),
    kiwi = require('kiwi'),
    io = require('./vendor/socket.io/lib/socket.io'),
    spawn = require('child_process').spawn,
    MessageRouter = require('./message_router').MessageRouter,
    serverConfig = require('./config').Config,
    redisConnectionManager = require('./model/redis_connection_manager').connectionManager,
    Class = kiwi.require('class').Class;

kiwi.require('ext');

var ChatServer = new Class({
// Public instance variables
    rooms: {},
    usersBySessionId: {},
    sessionsByUserId: {},
    
// Public methods
    constructor: function() {
        this.presenceDB = redisConnectionManager.getClient('presence');
        this.pubsub = redisConnectionManager.getClient('pubsub');
        this.messageRouter = new MessageRouter(this);
        
        this._http = http.createServer(function(req, res) {
            sys.log("Request for url " + req.url);
            res.writeHead(200, {'Content-Type': 'text/plain'});
            res.write("Nothing to see here.  Move along.\n");
            res.end();
        });
        
        // Socket.IO uses the "flashsocket" transport to enable the socket
        // policy file server on port 843.  We probably want to host this
        // socket policy file server elsewhere, like on the HAProxy machine.
        this._transports = serverConfig.hostFlashPolicyServer ?
            ['websocket', 'flashsocket', 'htmlfile', 'xhr-multipart', 'xhr-polling'] :
            ['websocket', 'htmlfile', 'xhr-multipart', 'xhr-polling'];
    },
    listen: function(port, serverId) {
        this.serverId = serverId;
        this.port = port;
        this._http.listen(this.port);
        this.listener = io.listen(this._http, {
            resource: this.serverId,
            transports: this._transports,
            origins: serverConfig.originPolicy.allowedOrigin || '*:*'
        });
        this.listener.addListener('clientConnect', this._handleClientConnect.bind(this));
        this.listener.addListener('clientDisconnect', this._handleClientDisconnect.bind(this));
        this.listener.addListener('clientMessage', this._handleClientMessage.bind(this));
        sys.log("Worlize ChatServer Ready.")
        sys.log("Server ID: " + this.serverId + "   Port: " + this.port);
        setInterval(this._pingUsers.bind(this), serverConfig.pingInterval);
        this.initializeControlChannel();
        this.setupHeartbeat();
    },
    
    initializeControlChannel: function() {
        this.pubsub.subscribeTo("control:" + this.serverId, function(channel, message, subscriptionPattern) {
            sys.log("Got message: " + message);
        });
    },
    
    setupHeartbeat: function() {
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
            setInterval(self._updatePresenceDatabase.bind(self), serverConfig.updatePresenceInterval);
        });
    },
    
// Private methods
    _handleClientConnect: function(client) {
        sys.log("Client ID " + client.sessionId + " connected");
    },
    _handleClientDisconnect: function(client) {
        sys.log("Client ID " + client.sessionId + " disconnected");
    },
    _handleClientMessage: function(message, client) {
        this.messageRouter.processMessage(message, client);
    },
    _pingUsers: function() {
        this.listener.broadcast('{"msg":"ping"}');
    },
    _updatePresenceDatabase: function() {
        var obj = {
            server_id: this.serverId,
            port: this.port,
            host: this.hostname,
            last_checkin: (new Date()).toISOString()
        };
        this.presenceDB.hset("interactServer", this.serverId, JSON.stringify(obj));
    }
});

exports.ChatServer = ChatServer;