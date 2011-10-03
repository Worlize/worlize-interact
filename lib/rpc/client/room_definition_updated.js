var sys = require('sys'),
    MessageEncoder = require('../message_encoder'),
    Message = require('../message');
    
var Msg = function(chatserver) {
    Message.call(this, chatserver);
};
sys.inherits(Msg, Message);

Msg.messageId = "room_definition_updated";
Msg.acceptFromClient = false;

Msg.prototype.send = function(client) {
    client.send(MessageEncoder.encode({
        msg: Msg.messageId
    }));
};

module.exports = Msg;