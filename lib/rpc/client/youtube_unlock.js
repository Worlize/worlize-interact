var sys = require('sys'),
    MessageEncoder = require('../message_encoder'),
    Message = require('../message');
    
var Msg = function(chatserver) {
    Message.call(this, chatserver);
    this.user = null;
    this.player = null;
};
sys.inherits(Msg, Message);

Msg.prototype.receive = function(message, client) {
    this.user = client.session.user;
    if (message.data) {
        this.player = message.data.player;
        if (client.session.room) {
            client.session.room.sendMessage(this);
        }
    }
};

Msg.prototype.send = function(client) {
    client.send(MessageEncoder.encode({
        msg: "youtube_unlock",
        data: {
            user: this.user.guid,
            player: this.player
        }
    }));
};

module.exports = Msg;