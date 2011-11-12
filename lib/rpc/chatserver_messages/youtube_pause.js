var sys = require('sys'),
    Log = require('../../util/log'),
    MessageEncoder = require('../message_encoder'),
    Message = require('../message');
    
var logger = Log.getLogger('rpc.chatserver_messages.YouTubePauseMessage');
    
var Msg = function(chatserver) {
    Message.call(this, chatserver);
    this.user = null;
    this.player = null;
};
sys.inherits(Msg, Message);

Msg.messageId = "youtube_pause";
Msg.acceptFromClient = true;

Msg.prototype.receive = function(message, user) {
    this.user = user;
    if (message.data) {
        this.player = message.data.player;
        if (user.currentRoom) {
            user.currentRoom.broadcast(this);
        }
    }
};

Msg.prototype.send = function(connection) {
    connection.send(MessageEncoder.encode({
        msg: Msg.messageId,
        data: {
            user: this.user.guid,
            player: this.player
        }
    }));
};

module.exports = Msg;