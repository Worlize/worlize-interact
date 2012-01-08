var util = require('util'),
    Log = require('../../util/log'),
    MessageEncoder = require('../message_encoder'),
    Message = require('../message');
    
var logger = Log.getLogger('rpc.chatserver_messages.RoomMsgMessage');
    
var Msg = function(chatserver) {
    Message.call(this, chatserver);
    this.user = null;
    this.text = "";
};
util.inherits(Msg, Message);

Msg.messageId = "room_msg";
Msg.acceptFromClient = true;

Msg.prototype.receive = function(message, user) {
    this.text = message.data;
    this.user = user;
    if (user.currentRoom) {
        user.currentRoom.broadcast(this);
    }
};

Msg.prototype.send = function(user) {
    user.connection.send(MessageEncoder.encode(this.getSerializableHash()));
};

Msg.prototype.getSerializableHash = function() {
    return {
        msg: Msg.messageId,
        data: {
            user: this.user.guid,
            text: this.text
        }
    };
};

module.exports = Msg;