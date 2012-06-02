var util = require('util'),
    Log = require('../../util/log'),
    MessageEncoder = require('../message_encoder'),
    Message = require('../message');

var logger = Log.getLogger('rpc.chatserver_messages.UserEnterMessage');
    
var UserEnterMessage = function(chatserver) {
    Message.call(this, chatserver);
    this.user = null;
};
util.inherits(UserEnterMessage, Message);

UserEnterMessage.messageId = "user_enter";
UserEnterMessage.acceptFromClient = false;

UserEnterMessage.prototype.send = function(user) {
    user.connection.send(MessageEncoder.encode(this.getSerializableHash()));
};

UserEnterMessage.prototype.getSerializableHash = function() {
    return {
        msg: UserEnterMessage.messageId,
        data: {
            userName: this.user.userName,
            guid: this.user.guid,
            position: this.user.position,
            face: this.user.state.face,
            color: this.user.state.color,
            avatar: this.user.state.avatar,
            facebookId: this.user.session.facebookId
        }
    };
};

module.exports = UserEnterMessage;