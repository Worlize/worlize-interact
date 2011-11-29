var util = require('util'),
    Log = require('../../util/log'),
    MessageEncoder = require('../message_encoder'),
    Message = require('../message');

var logger = Log.getLogger('rpc.chatserver_messages.YouTubeLoadMessage');
    
var Msg = function(chatserver) {
    Message.call(this, chatserver);
    this.user = null;
    this.player = null;
    this.videoId = null;
    this.autoPlay = null;
    this.roomGuid = null;
    this.duration = null; // in seconds
    this.title = null;
};
util.inherits(Msg, Message);

Msg.messageId = "youtube_load";
Msg.acceptFromClient = true;

Msg.prototype.receive = function(message, user) {
    this.user = user;
    if (message.data) {
        this.player = message.data.player;
        this.videoId = message.data.video_id;
        this.autoPlay = message.data.auto_play;
        this.duration = message.data.duration;
        this.title = message.data.title;
        if (user.currentRoom) {
            this.roomGuid = user.currentRoom.guid;
            user.currentRoom.broadcast(this);
        }
    }
};

Msg.prototype.send = function(user) {
    user.connection.send(MessageEncoder.encode({
        msg: Msg.messageId,
        data: {
            room: this.roomGuid,
            user: this.user.guid,
            player: this.player,
            video_id: this.videoId,
            auto_play: this.autoPlay,
            duration: this.duration,
            title: this.title
        }
    }));
};

module.exports = Msg;
