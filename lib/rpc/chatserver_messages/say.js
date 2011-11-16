var sys = require('sys'),
    Log = require('../../util/log'),
    MessageEncoder = require('../message_encoder'),
    Message = require('../message');
    
var logger = Log.getLogger('rpc.chatserver_messages.SayMessage');
    
var SayMessage = function(chatserver) {
    Message.call(this, chatserver);
    this.user = null;
};
sys.inherits(SayMessage, Message);

SayMessage.messageId = "say";
SayMessage.acceptFromClient = true;

SayMessage.prototype.receive = function(message, user) {
    this.text = message.data;
    this.user = user;
    if (user.currentRoom) {
        user.currentRoom.broadcast(this);
    }
};

SayMessage.prototype.send = function(user) {
    user.connection.send(MessageEncoder.encode(this.getSerializableHash()));
};

SayMessage.prototype.getSerializableHash = function() {
    return {
        msg: SayMessage.messageId,
        data: {
            user: this.user.guid,
            text: this.text
        }
    };
};

module.exports = SayMessage;