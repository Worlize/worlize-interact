var sys = require('sys'),
    Message = require('../message'),
    Session = require('../../model/session'),
    User = require('../../model/user'),
    MessageEncoder = require('../message_encoder'),
    SetVideoServerMessage = require('./set_video_server'),
    RoomRedirectMessage = require('./room_redirect'),
    UserEnterMessage = require('./user_enter');

var HandshakeMessage = function(chatserver) {
    Message.call(this, chatserver);
    this.session = null;
    this.guid = null;
    this.success = false;
};
sys.inherits(HandshakeMessage, Message);

HandshakeMessage.messageId = "handshake";
HandshakeMessage.acceptFromClient = true;

HandshakeMessage.prototype.receive = function(message, client) {
    if (client.session) {
        // already handshaked
        return;
    }
    this.session_guid = message.data.session_guid;
    this.client = client;
    this.getSessionData(this.session_guid);
};

HandshakeMessage.prototype.send = function(client) {
    var message = this.serializedMessage();
    client.send(MessageEncoder.encode(message));
};

HandshakeMessage.prototype.serializedMessage = function() {
    return {
        msg: HandshakeMessage.messageId,
        data: {
            success: this.success
        }
    };
};

HandshakeMessage.prototype.getSessionData = function(session_guid) {
    var self = this;
    
    this.log("Loading session " + session_guid);
    
    // Load the session...
    Session.load(session_guid, function(err, session) {
        if (err) {
            self.log("Unable to load session data for guid " + session_guid + ": " + err);
            self.client.close();
            return;
        }
        if (session) {
            self.session = session;
            self.client.session = session;
            session.client = self.client;
            self.success = true;
            self.handleSessionDataLoaded();
        }
    });
};

HandshakeMessage.prototype.handleSessionDataLoaded = function() {
    var self = this;
    var user; 
    var room;

    this.chatserver.roomManager.verifyRoomIsOnThisServer(this.session.roomGuid, function(err, result) {
        if (err) {
            // TODO: handle error;
            return;
        }
        if (result.verified) {
            loadRoom();
        }
        else {
            var redirectMessage = new RoomRedirectMessage();
            redirectMessage.room_guid = self.session.roomGuid;
            redirectMessage.server_id = result.actualServer;
            redirectMessage.send(self.client);
            self.client.close();
        }
    });

    function loadRoom() {
        self.chatserver.roomManager.getRoom(self.session.roomGuid, function(err, loadedRoom) {
            if (err) {
                // TODO: Handler room loading error
            }
            room = loadedRoom;
            self.session.room = room;
            handleRoomReady();
        });
    }
    
    // Step one - load room data
    function handleRoomReady() {
        user = new User(self.session.userGuid, self.session.userName);
        user.session = self.session;
        self.session.user = user;
        user.once('ready', handleUserReady);
        user.loadData();
    }
    
    // Step two - load user data
    function handleUserReady() {
        // Tell user which video server to connect to
        var videoServerMessage = new SetVideoServerMessage();
        videoServerMessage.room = room;
        videoServerMessage.send(self.client);
        
        // send current users to client...
        room.users.forEach(function(user) {
            var msg = new UserEnterMessage();
            msg.user = user;
            msg.send(self.client);
        });
        
        // boot any other users connected to the server with the same guid
        var oldUserClient = self.chatserver.connectedClientsByUserGuid[user.guid];
        if (oldUserClient && oldUserClient.session && oldUserClient.session.room) {
            oldUserClient.close();
        }

        self.chatserver.markAsHandshaked(self.client);
        
        // finally, enter the new user into the room.
        room.userEnter(user);

        self.send(self.client);
    }
};

HandshakeMessage.prototype.handleRoomReady = function() {
    
};

module.exports = HandshakeMessage;
