var util = require('util'),
    Log = require('../../util/log'),
    MessageEncoder = require('../message_encoder'),
    NakedMessage = require('./naked'),
    DisplayDialogMessage = require('./display_dialog'),
    RoomMsgMessage = require('./room_msg'),
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
    var msg;
    
    if (user.hasActiveRestriction('pin') ||
        user.hasActiveRestriction('block_avatars'))
    {
        msg = new DisplayDialogMessage();
        msg.message = "A moderator has revoked your ability to wear avatars.";
        user.sendMessage(msg);
        msg = new NakedMessage();
        msg.user = user;
        user.sendMessage(msg);
        return;
    }
    
    if (message.data) {
        if (user.currentRoom) {
            if (user.currentRoom.definition.properties.noAvatars) {
                msg = new RoomMsgMessage();
                msg.text = "Avatars are not allowed in this room.";
                msg.user = user;
                user.sendMessage(msg);
                msg = new NakedMessage();
                msg.user = user;
                user.sendMessage(msg);
                return;
            }
            user.currentRoom.broadcast(this, this.user.guid);
        }
        user.state.avatar = {
            type: "simple",
            guid: message.data
        };
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