var sys = require('sys'),
    MessageEncoder = require('../message_encoder'),
    Message = require('../message');
    
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
sys.inherits(Msg, Message);

Msg.prototype.receive = function(message, client) {
    this.user = client.session.user;
    if (message.data) {
        this.player = message.data.player;
        this.videoId = message.data.video_id;
        this.autoPlay = message.data.auto_play;
        this.duration = message.data.duration;
        this.title = message.data.title;
        if (client.session.room) {
            this.roomGuid = client.session.room.guid;
            client.session.room.sendMessage(this);
        }
    }
};

Msg.prototype.send = function(client) {
    client.send(MessageEncoder.encode({
        msg: "youtube_load",
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
