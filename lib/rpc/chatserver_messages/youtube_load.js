var util = require('util'),
    Log = require('../../util/log'),
    MessageEncoder = require('../message_encoder'),
    RoomMsgMessage = require('./room_msg'),
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
            logger.info("action=youtube_load videoId=" + this.videoId + " room=" + user.currentRoom.guid, user.logNotation);
            this.roomGuid = user.currentRoom.guid;
            var roomMsg = new RoomMsgMessage(this.chatserver);
            roomMsg.user = this.user;
            roomMsg.text = "Video changed by \"" + this.user.userName + "\" to \"" + this.title + "\"";
            user.currentRoom.broadcast(roomMsg);
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
