var sys = require('sys'),
    Message = require('../message'),
    Session = require('../../model/session'),
    User = require('../../model/user'),
    MessageEncoder = require('../message_encoder');

var Msg = function(chatserver) {
    Message.call(this, chatserver);
    this.session = null;
    this.guid = null;
    this.success = false;
};
sys.inherits(Msg, Message);

Msg.messageId = "handshake";
Msg.acceptFromClient = true;

Msg.prototype.receive = function(message, client) {
    if (client.session) {
        // already handshaked
        return;
    }
    this.session_guid = message.data.session_guid;
    this.client = client;
    this._getSessionData(this.session_guid);
};

Msg.prototype.send = function(client) {
    var message = this.serializedMessage();
    client.send(MessageEncoder.encode(message));
};

Msg.prototype.serializedMessage = function() {
    return {
        msg: Msg.messageId,
        data: {
            success: this.success
        }
    };
};

Msg.prototype._getSessionData = function(session_guid) {
    var self = this;
    
    this.log("Presence: Loading session " + session_guid);
    
    // Load the session...
    this.session = Session.load(session_guid, function(err, session) {
        if (session) {
            self.client.session = session;
            session.client = self.client;
            self.success = true;

            var user = new User(session.userGuid, session.userName);
            user.session = session;
            session.user = user;
            
            // Once the user object has loaded any necessary state data...
            user.on('ready', function() {
                // boot any other users connected to the server with the same guid
                var oldUserClient = self.chatserver.connectedClientsByUserGuid[user.guid];
                if (oldUserClient) {
                    oldUserClient.close();
                }

                self.chatserver.markAsHandshaked(self.client);
                
                self.send(self.client);
            });
            user.loadData();
        }
        else {
            self.log("Presence: Unable to load session data for guid " + session_guid + ": " + err);
        }
    });
};

module.exports = Msg;
