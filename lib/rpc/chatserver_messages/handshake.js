var sys = require('sys'),
    Message = require('../message'),
    Session = require('../../model/session'),
    User = require('../../model/user'),
    MessageEncoder = require('../message_encoder'),
    SetVideoServerMessage = require('./set_video_server'),
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
    this._getSessionData(this.session_guid);
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

HandshakeMessage.prototype._getSessionData = function(session_guid) {
    var self = this;
    
    this.log("Loading session " + session_guid);
    
    // Load the session...
    this.session = Session.load(session_guid, function(err, session) {
        if (session) {
            self.client.session = session;
            session.client = self.client;
            self.success = true;

            var user = new User(session.userGuid, session.userName);
            user.session = session;
            session.user = user;
            
            var room = self.chatserver.roomManager.getRoom(session.roomGuid);
            session.room = room;

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

            // Once the user object has loaded any necessary state data...
            user.on('ready', function() {
              
                // boot any other users connected to the server with the same guid
                var oldUserClient = self.chatserver.connectedClientsByUserGuid[user.guid];
                if (oldUserClient) {
                  if (oldUserClient.session.room) {
                    oldUserClient.close();
                  }
                }

                self.chatserver.markAsHandshaked(self.client);
                
                // finally, enter the new user into the room.
                room.userEnter(user);

                self.send(self.client);
            });
            user.loadData();

        }
        else {
            self.log("Unable to load session data for guid " + session_guid + ": " + err);
        }
    });
};

module.exports = HandshakeMessage;