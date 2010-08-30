var sys = require('sys'),
    kiwi = require('kiwi'),
    Class = kiwi.require('class').Class,
    Message = require('../message'),
    Session = require('../../model/session'),
    MessageEncoder = require('../message_encoder'),
    UserEnterMessage = require('./user_enter');

kiwi.require('ext'); /* Provides Function#bind */

var HandshakeMessage = new Message.extend({
    constructor: function(chatserver) {
        Message.call(this, chatserver);
        this.session = null;
        this.guid = null;
        this.success = false;
    },
    receive: function(message, client) {
        if (client.session) {
            // already handshaked
            return;
        }
        this.session_guid = message.data.session_guid;
        this.client = client;
        this._getSessionData(this.session_guid);
        // sys.log("Loading session " + this.session_guid);
    },
    send: function(client) {
        var message = this.serializedMessage();
        client.send(MessageEncoder.encode(message));
    },
    serializedMessage: function() {
        return {
            msg: "handshake",
            data: {
                success: this.success
            }
        };
    },
    _getSessionData: function(session_guid) {
        var self = this;
        
        // Load the session...
        this.session = Session.load(session_guid, function(err, session) {
            if (session) {
                self.client.session = session;
                session.client = self.client;
                self.success = true;

                var user = self.chatserver.userManager.getUser(session.userGuid, session.userName);
                user.session = session;
                session.user = user;
                
                var room = self.chatserver.roomManager.getRoom(session.roomGuid);
                session.room = room;

                // send current users to client...
                room.users.forEach(function(user) {
                    var msg = new UserEnterMessage();
                    msg.user = user;
                    msg.send(self.client);
                });

                self.chatserver.markAsHandshaked(self.client);

                // finally, enter the new user into the room.
                room.userEnter(user);
                
                self.send(self.client);
            }
            else {
                sys.log("Unable to load session data for guid " + session_guid + ": " + err);
            }
        });
    }
});

module.exports = HandshakeMessage;
