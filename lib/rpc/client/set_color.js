var sys = require('sys'),
    MessageEncoder = require('../message_encoder'),
    Message = require('../message');
    
var Msg = function(chatserver) {
    Message.call(this, chatserver);
    this.session = null;
    this.user = null;
};
sys.inherits(Msg, Message);

Msg.prototype.receive = function(message, client) {
    this.user = client.session.user;
    if (message.data) {
        this.user.state.color = message.data;
        if (client.session.room) {
            client.session.room.sendMessage(this, this.user.guid);
        }
        this.user.state.save();
    }
};

Msg.prototype.send = function(client) {
    client.send(MessageEncoder.encode({
        msg: "set_color",
        data: {
            user: this.user.guid,
            color: this.user.state.color
        }
    }));
};

module.exports = Msg;