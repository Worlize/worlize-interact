var sys = require('sys'),
    MessageEncoder = require('../message_encoder'),
    Message = require('../message');
    
var Msg = function(chatserver) {
    Message.call(this, chatserver);
    this.roomGuid = null;
};
sys.inherits(Msg, Message);

Msg.messageId = "room_entered";
Msg.acceptFromClient = false;

Msg.prototype.send = function(client) {
    client.send(MessageEncoder.encode({
        msg: Msg.messageId,
        data: this.roomGuid
    }));
};

module.exports = Msg;