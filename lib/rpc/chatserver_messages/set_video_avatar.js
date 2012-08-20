var util = require('util'),
    Log = require('../../util/log'),
    MessageEncoder = require('../message_encoder'),
    NakedMessage = require('./naked'),
    DisplayDialogMessage = require('./display_dialog'),
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
        var msg = new DisplayDialogMessage();
        msg.message = "A moderator has revoked your ability to broadcast your webcam.";
        user.sendMessage(msg);
        msg = new NakedMessage();
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