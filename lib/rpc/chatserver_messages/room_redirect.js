var sys = require('sys'),
    MessageEncoder = require('../message_encoder'),
    Message = require('../message');
    
var Msg = function(chatserver) {
    Message.call(this, chatserver);
    this.room_guid = null;
};
sys.inherits(Msg, Message);

Msg.messageId = "room_redirect";
Msg.acceptFromClient = false;

Msg.prototype.send = function(client) {
    client.send(MessageEncoder.encode({
        msg: Msg.messageId,
        data: {
            room: this.room_guid
        }
    }));
};

module.exports = Msg;
