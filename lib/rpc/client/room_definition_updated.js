var sys = require('sys'),
    MessageEncoder = require('../message_encoder'),
    Message = require('../message');
    
var Msg = function(chatserver) {
    Message.call(this, chatserver);
};
sys.inherits(Msg, Message);

Msg.prototype.send = function(client) {
    client.send(MessageEncoder.encode({
        msg: "room_definition_updated"
    }));
};

module.exports = Msg;