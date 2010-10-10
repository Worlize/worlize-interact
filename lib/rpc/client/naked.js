var sys = require('sys'),
    MessageEncoder = require('../message_encoder'),
    Message = require('../message');
    
var Msg = function(chatserver) {
    Message.call(this, chatserver);
    this.user = null;
};
sys.inherits(Msg, Message);

Msg.prototype.receive = function(message, client) {
    this.user = client.session.user;
    this.user.state.avatar = null;
    if (client.session.room) {
        client.session.room.sendMessage(this, this.user.guid);
    }
    this.user.state.save();
};

Msg.prototype.send = function(client) {
    client.send(MessageEncoder.encode({
        msg: "naked",
        data: {
            user: this.user.guid
        }
    }));
};

module.exports = Msg;
