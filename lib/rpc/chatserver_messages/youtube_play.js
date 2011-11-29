var util = require('util'),
    Log = require('../../util/log'),
    MessageEncoder = require('../message_encoder'),
    Message = require('../message');
    
var logger = Log.getLogger('rpc.chatserver_messages.YouTubePlayMessage');

var Msg = function(chatserver) {
    Message.call(this, chatserver);
    this.user = null;
    this.player = null;
    this.roomGuid = null;
};
util.inherits(Msg, Message);

Msg.messageId = "youtube_play";
Msg.acceptFromClient = true;

Msg.prototype.receive = function(message, user) {
    this.user = user;
    if (message.data) {
        this.player = message.data.player;
        if (user.currentRoom) {
            this.roomGuid = user.currentRoom.guid;
            user.currentRoom.broadcast(this);
        }
    }
};

Msg.prototype.send = function(user) {
    user.connection.send(MessageEncoder.encode({
        msg: Msg.messageId,
        data: {
            room: this.roomGuid,
            user: this.user.guid,
            player: this.player
        }
    }));
};

module.exports = Msg;