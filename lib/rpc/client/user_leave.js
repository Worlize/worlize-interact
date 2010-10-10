var sys = require('sys'),
    MessageEncoder = require('../message_encoder'),
    Message = require('../message');
    
var UserLeaveMessage = function(chatserver) {
    Message.call(this, chatserver);
    this.user = null;
};
sys.inherits(UserLeaveMessage, Message);

UserLeaveMessage.prototype.send = function(client) {
    client.send(MessageEncoder.encode({
        msg: "user_leave",
        data: this.user.guid
    }));
};

module.exports = UserLeaveMessage;
