var sys = require('sys'),
    MessageEncoder = require('../message_encoder'),
    Message = require('../message');
    
var Msg = function(chatserver) {
    Message.call(this, chatserver);
    this.videoServer = "rtmp://fms1.dallas.worlize.com/videochat";
    this.roomGuid = null;
};
sys.inherits(Msg, Message);

Msg.prototype.send = function(client) {
    client.send(MessageEncoder.encode({
        msg: "set_video_server",
        data: this.videoServer + "/" + this.roomGuid
    }));
};

module.exports = Msg;