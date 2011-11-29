var util = require('util'),
    Log = require('../../util/log'),
    MessageEncoder = require('../message_encoder'),
    Message = require('../message');
    
var logger = Log.getLogger('rpc.chatserver_messages.RoomDefinitionUpdatedMessage');
    
var Msg = function(chatserver) {
    Message.call(this, chatserver);
};
util.inherits(Msg, Message);

Msg.messageId = "room_definition_updated";
Msg.acceptFromClient = false;

Msg.prototype.send = function(user) {
    user.connection.send(MessageEncoder.encode({
        msg: Msg.messageId
    }));
};

module.exports = Msg;