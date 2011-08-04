var sys = require('sys'),
    MessageEncoder = require('../message_encoder'),
    Message = require('../message');
    
var Msg = function(chatserver) {
    Message.call(this, chatserver);
    this.room = null;
};
sys.inherits(Msg, Message);

Msg.prototype.send = function(client) {
    client.send(MessageEncoder.encode({
        msg: "set_video_server",
        data: this.room.streamingServer + "/" + this.room.guid
    }));
};

module.exports = Msg;