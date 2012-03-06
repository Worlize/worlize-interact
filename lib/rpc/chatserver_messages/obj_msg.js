var util = require('util'),
    Log = require('../../util/log'),
    MessageEncoder = require('../message_encoder'),
    Message = require('../message');
    
var logger = Log.getLogger('rpc.chatserver_messages.ObjMsgMessage');
    
var Msg = function(chatserver) {
    Message.call(this, chatserver);
    this.room = null;
    this.from = null;
    this.to = null;
    this.toUser = null;
    this.msg = null;
};
util.inherits(Msg, Message);

Msg.messageId = "obj_msg";
Msg.acceptFromClient = true;

Msg.prototype.receive = function(message, user) {
    this.user = user;
    
    if (message.data) {
        var data = message.data;
        this.from = data.from;
        this.msg = data.msg;
        this.to = data.to;
        if (user.currentRoom) {
            this.room = user.currentRoom.guid;
            if (data.toUser) {
                var recipient = this.room.getUserByGuid(data.toUser);
                if (recipient) {
                    recipient.sendMessage(this);
                }
            }
            else {
                user.currentRoom.broadcast(this);
            }
        }
    }
};

Msg.prototype.send = function(user) {
    user.connection.send(MessageEncoder.encode({
        msg: Msg.messageId,
        data: {
            room: this.room,
            from: this.from,
            msg: this.msg,
            to: this.to
        }
    }));
};

module.exports = Msg;