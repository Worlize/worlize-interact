var sys = require('sys'),
    Log = require('../../util/log'),
    MessageEncoder = require('../message_encoder'),
    Message = require('../message');

var logger = Log.getLogger('rpc.chatserver_messages.Whisper');
    
var WhisperMessage = function(chatserver) {
    Message.call(this, chatserver);
    this.session = null;
    this.user = null;
    this.to_user = null;
};
sys.inherits(WhisperMessage, Message);

WhisperMessage.messageId = "whisper";
WhisperMessage.acceptFromClient = true;

WhisperMessage.prototype.receive = function(message, user) {
    this.text = message.data.text;
    this.to_user = message.data.to_user;
    this.user = user;
    if (user.currentRoom) {
        var recipient = user.currentRoom.getUserByGuid(this.to_user);
        if (recipient) {
            recipient.sendMessage(this);
            user.sendMessage(this);
        }
        else {
            logger.warn("Unable to locate the specified recipient: " + this.to_user, user.guid);
        }
    }
};

WhisperMessage.prototype.send = function(connection) {
    connection.send(MessageEncoder.encode(this.getSerializableHash()));
};

WhisperMessage.prototype.getSerializableHash = function() {
    return {
        msg: WhisperMessage.messageId,
        data: {
            user: this.user.guid,
            text: this.text
        }
    };
};

module.exports = WhisperMessage;