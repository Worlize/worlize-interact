var sys = require('sys'),
    MessageEncoder = require('../message_encoder'),
    Message = require('../message');
    
var SayMessage = function(chatserver) {
    Message.call(this, chatserver);
    this.session = null;
    this.user = null;
};
sys.inherits(SayMessage, Message);

SayMessage.prototype.receive = function(message, client) {
    this.text = message.data;
    this.user = client.session.user;
    if (client.session.room) {
        client.session.room.sendMessage(this);
    }
//        sys.log("[" + client.session.guid + "] Say: '" + message.data + "'");
};


SayMessage.prototype.send = function(client) {
    var message = this.serializedMessage();
    client.send(MessageEncoder.encode(message));
};

SayMessage.prototype.serializedMessage = function() {
    return {
        msg: "say",
        data: {
            user: this.user.guid,
            text: this.text
        }
    };
};

module.exports = SayMessage;