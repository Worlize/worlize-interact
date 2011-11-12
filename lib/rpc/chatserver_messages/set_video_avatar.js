var sys = require('sys'),
    Log = require('../../util/log'),
    MessageEncoder = require('../message_encoder'),
    Message = require('../message');
    
var logger = Log.getLogger('rpc.chatserver_messages.SetVideoAvatarMessage');
    
var Msg = function(chatserver) {
    Message.call(this, chatserver);
    this.session = null;
    this.user = null;
};
sys.inherits(Msg, Message);

Msg.messageId = "set_video_avatar";
Msg.acceptFromClient = true;

Msg.prototype.receive = function(message, user) {
    this.user = user;
    user.state.avatar = {
        type: "video"
    };
    if (user.currentRoom) {
        user.currentRoom.broadcast(this);
    }
    user.state.save();
};

Msg.prototype.send = function(connection) {
    connection.send(MessageEncoder.encode({
        msg: Msg.messageId,
        data: {
            user: this.user.guid
        }
    }));
};

module.exports = Msg;