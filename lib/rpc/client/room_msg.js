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
    this.text = message.data;
    this.user = client.session.user;
    if (client.session.room) {
        client.session.room.sendMessage(this);
    }
};

Msg.prototype.send = function(client) {
    var message = this.serializedMessage();
    client.send(MessageEncoder.encode(message));
};

Msg.prototype.serializedMessage = function() {
    return {
        msg: "room_msg",
        data: {
            user: this.user.guid,
            text: this.text
        }
    };
};

module.exports = Msg;