var util = require('util'),
    Log = require('../../util/log'),
    MessageEncoder = require('../message_encoder'),
    Message = require('../message');
    
var logger = Log.getLogger('rpc.chatserver_messages.RoomDefinitionMessage');
    
var RoomDefinitionMessage = function(chatserver) {
    Message.call(this, chatserver);
    this.roomDefinition = null;
    this.room = null;
};
util.inherits(RoomDefinitionMessage, Message);

RoomDefinitionMessage.messageId = "room_definition";
RoomDefinitionMessage.acceptFromClient = false;

RoomDefinitionMessage.prototype.send = function(user) {
    user.connection.send(MessageEncoder.encode(this.getSerializableHash()));
};

RoomDefinitionMessage.prototype.getSerializableHash = function() {
    return {
        msg: RoomDefinitionMessage.messageId,
        data: this.roomDefinition.getSerializableHash()
    };
};

module.exports = RoomDefinitionMessage;
