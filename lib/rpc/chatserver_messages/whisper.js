var sys = require('sys'),
    MessageEncoder = require('../message_encoder'),
    Message = require('../message');
    
var WhisperMessage = function(chatserver) {
    Message.call(this, chatserver);
    this.session = null;
    this.user = null;
    this.to_user = null;
};
sys.inherits(WhisperMessage, Message);

WhisperMessage.messageId = "whisper";
WhisperMessage.acceptFromClient = true;

WhisperMessage.prototype.receive = function(message, client) {
    this.text = message.data.text;
    this.to_user = message.data.to_user;
    this.user = client.session.user;
    if (client.session.room) {
        var recipient = client.session.room.getUserByGuid(this.to_user);
        if (recipient) {
            recipient.sendMessage(this);
            this.user.sendMessage(this);
        }
        else {
            this.log("Unable to locate the specified recipient: " + this.to_user);
        }
    }
};

WhisperMessage.prototype.send = function(client) {
    var message = this.serializedMessage();
    client.send(MessageEncoder.encode(message));
};

WhisperMessage.prototype.serializedMessage = function() {
    return {
        msg: WhisperMessage.messageId,
        data: {
            user: this.user.guid,
            text: this.text
        }
    };
};

module.exports = WhisperMessage;