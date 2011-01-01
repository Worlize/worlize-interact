var sys = require('sys'),
    MessageEncoder = require('../message_encoder'),
    Message = require('../message');
    
var Msg = function(chatserver) {
    Message.call(this, chatserver);
    this.user = null;
    this.player = null;
    this.seekTo = null;
};
sys.inherits(Msg, Message);

Msg.prototype.receive = function(message, client) {
    this.user = client.session.user;
    if (message.data) {
        this.player = message.data.player;
        this.seekTo = message.data.seek_to;
        if (client.session.room) {
            client.session.room.sendMessage(this);
        }
    }
};

Msg.prototype.send = function(client) {
    client.send(MessageEncoder.encode({
        msg: "youtube_seek",
        data: {
            user: this.user.guid,
            player: this.player,
            seek_to: this.seekTo
        }
    }));
};

module.exports = Msg;