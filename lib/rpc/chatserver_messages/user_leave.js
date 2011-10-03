var sys = require('sys'),
    MessageEncoder = require('../message_encoder'),
    Message = require('../message');
    
var UserLeaveMessage = function(chatserver) {
    Message.call(this, chatserver);
    this.user = null;
};
sys.inherits(UserLeaveMessage, Message);

UserLeaveMessage.messageId = "user_leave";
UserLeaveMessage.acceptFromClient = false;

UserLeaveMessage.prototype.send = function(client) {
    client.send(MessageEncoder.encode({
        msg: UserLeaveMessage.messageId,
        data: this.user.guid
    }));
};

module.exports = UserLeaveMessage;
