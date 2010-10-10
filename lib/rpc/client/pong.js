var sys = require('sys'),
    MessageEncoder = require('../message_encoder'),
    Message = require('../message');
    
var msg = function(chatserver) {
    Message.call(this, chatserver);
};
sys.inherits(msg, Message);

msg.prototype.receive = function(message, client) {
    // do nothing
};

msg.prototype.send = function(client) {
    var message = this.serializedMessage();
    client.send(MessageEncoder.encode(message));
};

msg.prototype.serializedMessage = function() {
    return {
        msg: "pong"
    };
};

module.exports = msg;