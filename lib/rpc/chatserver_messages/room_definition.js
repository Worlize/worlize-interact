var sys = require('sys'),
    Log = require('../../util/log'),
    MessageEncoder = require('../message_encoder'),
    Message = require('../message');
    
var logger = Log.getLogger('rpc.chatserver_messages.RoomDefinitionMessage');
    
var RoomDefinitionMessage = function(chatserver) {
    Message.call(this, chatserver);
    this.roomDefinition = null;
};
sys.inherits(RoomDefinitionMessage, Message);

RoomDefinitionMessage.messageId = "room_definition";
RoomDefinitionMessage.acceptFromClient = false;

RoomDefinitionMessage.prototype.send = function(connection) {
    connection.send(MessageEncoder.encode(this.getSerializableHash()));
};

RoomDefinitionMessage.prototype.getSerializableHash = function() {
    return {
        msg: RoomDefinitionMessage.messageId,
        data: this.roomDefinition.getSerializableHash();
    };
};

module.exports = RoomDefinitionMessage;
