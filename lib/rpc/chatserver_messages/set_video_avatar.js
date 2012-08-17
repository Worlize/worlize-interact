var util = require('util'),
    Log = require('../../util/log'),
    MessageEncoder = require('../message_encoder'),
    NakedMessage = require('./naked'),
    RoomMsgMessage = require('./room_msg'),
    Message = require('../message');
    
var logger = Log.getLogger('rpc.chatserver_messages.SetVideoAvatarMessage');
    
var Msg = function(chatserver) {
    Message.call(this, chatserver);
    this.user = null;
};
util.inherits(Msg, Message);

Msg.messageId = "set_video_avatar";
Msg.acceptFromClient = true;

Msg.prototype.receive = function(message, user) {
    if (user.hasActiveRestriction('pin') ||
        user.hasActiveRestriction('block_webcams'))
    {
        var roomMsg = new RoomMsgMessage();
        roomMsg.text = "A moderator has restricted your ability to broadcast your webcam.";
        roomMsg.user = user;
        user.sendMessage(roomMsg);
        var msg = new NakedMessage();
        msg.user = user;
        user.sendMessage(msg);
        return;
    }
    
    this.user = user;
    user.state.avatar = {
        type: "video"
    };
    if (user.currentRoom) {
        user.currentRoom.broadcast(this);
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