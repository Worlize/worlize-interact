var util = require('util'),
    Log = require('../../util/log'),
    MessageEncoder = require('../message_encoder'),
    Message = require('../message');
    
var logger = Log.getLogger('rpc.chatserver_messages.SetVideoServerMessage');
    
var Msg = function(chatserver) {
    Message.call(this, chatserver);
    this.room = null;
};
util.inherits(Msg, Message);

Msg.messageId = "set_video_server";
Msg.acceptFromClient = false;

Msg.prototype.send = function(user) {
    user.connection.send(MessageEncoder.encode({
        msg: Msg.messageId,
        data: this.room.streamingServer + "/" + this.room.guid
    }));
};

module.exports = Msg;