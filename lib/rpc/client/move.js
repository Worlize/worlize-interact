var sys = require('sys'),
    MessageEncoder = require('../message_encoder'),
    Message = require('../message');
    
var MoveMessage = function(chatserver) {
    Message.call(this, chatserver);
    this.session = null;
    this.user = null;
};
sys.inherits(MoveMessage, Message);

MoveMessage.prototype.receive = function(message, client) {
    this.user = client.session.user;
    if (message.data) {
        this.user.position = [ message.data[0], message.data[1] ];
        if (client.session.room) {
            client.session.room.sendMessage(this, this.user.guid);
        }
    }
};

MoveMessage.prototype.send = function(client) {
    var message = this.serializedMessage();
    client.send(MessageEncoder.encode(message));
};

MoveMessage.prototype.serializedMessage = function() {
    return {
        msg: "move",
        data: {
            user: this.user.guid,
            position: this.user.position
        }
    };
};

module.exports = MoveMessage;