var sys = require('sys'),
    MessageEncoder = require('../message_encoder'),
    Message = require('../message');
    
var RoomDefinitionMessage = function(chatserver) {
    Message.call(this, chatserver);
    this.roomDefinition = null;
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
        data: this.roomDefinition
    };
};

module.exports = RoomDefinitionMessage;
