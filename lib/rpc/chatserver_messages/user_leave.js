var util = require('util'),
    Log = require('../../util/log'),
    MessageEncoder = require('../message_encoder'),
    Message = require('../message');
    
var logger = Log.getLogger('rpc.chatserver_messages.UserLeaveMessage');
    
var UserLeaveMessage = function(chatserver) {
    Message.call(this, chatserver);
    this.user = null;
};
util.inherits(UserLeaveMessage, Message);

UserLeaveMessage.messageId = "user_leave";
UserLeaveMessage.acceptFromClient = false;

UserLeaveMessage.prototype.send = function(user) {
    user.connection.send(MessageEncoder.encode({
        msg: UserLeaveMessage.messageId,
        data: this.user.guid
    }));
};

module.exports = UserLeaveMessage;
