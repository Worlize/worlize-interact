var util = require('util'),
    Log = require('../../util/log'),
    MessageEncoder = require('../message_encoder'),
    Message = require('../message');
    
var logger = Log.getLogger('rpc.chatserver_messages.NakedMessage');

var Msg = function(chatserver) {
    Message.call(this, chatserver);
    this.user = null;
};
util.inherits(Msg, Message);

Msg.messageId = "naked";
Msg.acceptFromClient = true;

Msg.prototype.receive = function(message, user) {
    this.user = user;
    user.state.avatar = null;
    if (user.currentRoom) {
        user.currentRoom.broadcast(this, user.guid);
    }
    user.state.save();
};

Msg.prototype.send = function(user) {
    user.connection.send(MessageEncoder.encode({
        msg: Msg.messageId,
        data: {
            user: this.user.guid
        }
    }));
};

module.exports = Msg;
