var sys = require('sys'),
    Log = require('../../util/log'),
    MessageEncoder = require('../message_encoder'),
    Message = require('../message');

var logger = Log.getLogger('rpc.chatserver_messages.SetColor');

var Msg = function(chatserver) {
    Message.call(this, chatserver);
    this.user = null;
};
sys.inherits(Msg, Message);

Msg.messageId = "set_color";
Msg.acceptFromClient = true;

Msg.prototype.receive = function(message, user) {
    this.user = user;
    if (message.data) {
        var newColor = parseInt(message.data, 10);
        if (isNaN(newColor)) {
            // Illegal non-numeric color value.  Reset the color on the client
            logger.warn("User attempted to set non-numeric color.", user.logNotation);
            user.sendMessage(this);
            return;
        }
        user.state.color = newColor;
        if (user.currentRoom) {
            user.currentRoom.broadcast(this, user.guid);
        }
        user.state.save();
    }
};

Msg.prototype.send = function(user) {
    user.connection.send(MessageEncoder.encode({
        msg: Msg.messageId,
        data: {
            user: this.user.guid,
            color: this.user.state.color
        }
    }));
};

module.exports = Msg;