var sys = require('sys'),
    MessageEncoder = require('../message_encoder'),
    Message = require('../message');
    
var UserEnterMessage = function(chatserver) {
    Message.call(this, chatserver);
    this.user = null;
};
sys.inherits(UserEnterMessage, Message);

UserEnterMessage.prototype.send = function(client) {
    var message = this.serializedMessage();
    client.send(MessageEncoder.encode(message));
};

UserEnterMessage.prototype.serializedMessage = function() {
    return {
        msg: "user_enter",
        data: {
            userName: this.user.userName,
            guid: this.user.guid,
            position: this.user.position,
            face: this.user.state.face,
            color: this.user.state.color,
            avatar: this.user.state.avatar
        }
    };
};

module.exports = UserEnterMessage;