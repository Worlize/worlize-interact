var sys = require('sys'),
    Log = require('../../util/log'),
    MessageEncoder = require('../message_encoder'),
    Message = require('../message');
    
var logger = Log.getLogger('rpc.chatserver_messages.RoomRedirectMessage');
    
var Msg = function(chatserver) {
    Message.call(this, chatserver);
    this.roomGuid = null;
};
sys.inherits(Msg, Message);

Msg.messageId = "room_redirect";
Msg.acceptFromClient = false;

Msg.prototype.send = function(user) {
    logger.info("Sending room redirect message for room " + this.roomGuid, user.logNotation);
    user.connection.send(MessageEncoder.encode({
        msg: Msg.messageId,
        data: {
            room: this.roomGuid
        }
    }));
};

module.exports = Msg;
