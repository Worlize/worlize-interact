var sys = require('sys'),
    MessageEncoder = require('../message_encoder'),
    Message = require('../message');
    
var Msg = function(chatserver) {
    Message.call(this, chatserver);
    this.session = null;
    this.user = null;
};
sys.inherits(Msg, Message);

Msg.messageId = "set_video_avatar";
Msg.acceptFromClient = true;

Msg.prototype.receive = function(message, client) {
    this.user = client.session.user;
    this.user.state.avatar = {
        type: "video"
    };
    if (client.session.room) {
        client.session.room.sendMessage(this);
    }
    this.user.state.save();
};

Msg.prototype.send = function(client) {
    client.send(MessageEncoder.encode({
        msg: Msg.messageId,
        data: {
            user: this.user.guid
        }
    }));
};

module.exports = Msg;