var sys = require('sys'),
    Log = require('../../util/log'),
    MessageEncoder = require('../message_encoder'),
    Message = require('../message');
    
var logger = Log.getLogger('rpc.chatserver_messages.SetFace');
    
var Msg = function(chatserver) {
    Message.call(this, chatserver);
    this.session = null;
    this.user = null;
};
sys.inherits(Msg, Message);

Msg.messageId = "set_face";
Msg.acceptFromClient = true;

Msg.prototype.receive = function(message, user) {
    this.user = user;
    if (message.data) {
        var newFace = parseInt(message.data, 10);
        if (isNaN(newFace)) {
            // Illegal non-numeric face value, resetting face on client.
            logger.warn("User " + user.guid + " attempted to set non-numeric face.");
            this.send(user.connection);
            return;
        }
        user.state.face = newFace;
        if (user.currentRoom) {
            user.currentRoom.sendMessage(this, user.guid);
        }
        user.state.save();
    }
};

Msg.prototype.send = function(connection) {
    connection.send(MessageEncoder.encode({
        msg: Msg.messageId,
        data: {
            user: this.user.guid,
            face: this.user.state.face
        }
    }));
};

module.exports = Msg;