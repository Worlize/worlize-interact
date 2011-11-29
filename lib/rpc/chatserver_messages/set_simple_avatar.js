var util = require('util'),
    Log = require('../../util/log'),
    MessageEncoder = require('../message_encoder'),
    Message = require('../message');
    
var logger = Log.getLogger('rpc.chatserver_messages.SetSimpleAvatarMessage');
    
var Msg = function(chatserver) {
    Message.call(this, chatserver);
    this.user = null;
};
util.inherits(Msg, Message);

Msg.messageId = "set_simple_avatar";
Msg.acceptFromClient = true;

Msg.prototype.receive = function(message, user) {
    this.user = user;
    if (message.data) {
        user.state.avatar = {
            type: "simple",
            guid: message.data
        };
        if (user.currentRoom) {
            user.currentRoom.broadcast(this, this.user.guid);
        }
        user.state.save();
    }
};

Msg.prototype.send = function(user) {
    user.connection.send(MessageEncoder.encode({
        msg: Msg.messageId,
        data: {
            user: this.user.guid,
            avatar: this.user.state.avatar
        }
    }));
};

module.exports = Msg;