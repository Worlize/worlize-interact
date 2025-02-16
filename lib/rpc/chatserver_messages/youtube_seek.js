var util = require('util'),
    Log = require('../../util/log'),
    MessageEncoder = require('../message_encoder'),
    Message = require('../message');
    
var logger = Log.getLogger('rpc.chatserver_messages.YouTubeSeekMessage');
    
var Msg = function(chatserver) {
    Message.call(this, chatserver);
    this.user = null;
    this.player = null;
    this.seekTo = null;
};
util.inherits(Msg, Message);

Msg.messageId = "youtube_seek";
Msg.acceptFromClient = true;

Msg.prototype.receive = function(message, user) {
    this.user = user;
    if (message.data) {
        this.player = message.data.player;
        this.seekTo = message.data.seek_to;
        if (user.currentRoom) {
            user.currentRoom.broadcast(this);
        }
    }
};

Msg.prototype.send = function(user) {
    user.connection.send(MessageEncoder.encode({
        msg: Msg.messageId,
        data: {
            user: this.user.guid,
            player: this.player,
            seek_to: this.seekTo
        }
    }));
};

module.exports = Msg;