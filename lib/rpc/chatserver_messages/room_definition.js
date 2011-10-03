var sys = require('sys'),
    MessageEncoder = require('../message_encoder'),
    Message = require('../message');
    
var RoomDefinitionMessage = function(chatserver) {
    Message.call(this, chatserver);
    this.room = null;
};
sys.inherits(RoomDefinitionMessage, Message);

RoomDefinitionMessage.messageId = "room_definition";
RoomDefinitionMessage.acceptFromClient = false;

RoomDefinitionMessage.prototype.send = function(client) {
    var message = this.serializedMessage();
    client.send(MessageEncoder.encode(message));
};

RoomDefinitionMessage.prototype.serializedMessage = function() {
    return {
        msg: RoomDefinitionMessage.messageId,
        data: this.room
    };
};

module.exports = RoomDefinitionMessage;
