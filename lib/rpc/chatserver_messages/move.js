var util = require('util'),
    Log = require('../../util/log'),
    config = require('../../config'),
    MessageEncoder = require('../message_encoder'),
    Message = require('../message');
    
var logger = Log.getLogger('rpc.chatserver_messages.MoveMessage');

var MoveMessage = function(chatserver) {
    Message.call(this, chatserver);
    this.user = null;
};
util.inherits(MoveMessage, Message);

MoveMessage.messageId = "move";
MoveMessage.acceptFromClient = true;

MoveMessage.prototype.receive = function(message, user) {
    this.user = user;
    if (message.data) {
        if (!Array.isArray(message.data)) {
            logger.error("Data for 'move' message is invalid.", user.logNotation);
            user.connection.drop(1000);
            return;
        }
        var x = parseInt(message.data[0]);
        var y = parseInt(message.data[1]);
        
        if (isNaN(x) || isNaN(y)) {
            // Non-numeric inputs, reset user's position on client
            logger.warn("User " + user.guid + " attempted to set non-numeric position.", user.logNotation);
            user.sendMessage(this);
            return;
        }
        if (x < 0 || y < 0 || x > config.roomWidth || y > config.roomHeight-25) {
            // Illegal position, reset user's position on client
            logger.warn("User " + user.guid + " attempted to set an out-of-bounds position.", user.logNotation);
            user.sendMessage(this);
            return;
        }

        this.user.position = [ x, y ];
        if (user.currentRoom) {
            user.currentRoom.broadcast(this, this.user.guid);
        }
    }
};

MoveMessage.prototype.send = function(user) {
    user.connection.send(MessageEncoder.encode(this.getSerializableHash()));
};

MoveMessage.prototype.getSerializableHash = function() {
    return {
        msg: MoveMessage.messageId,
        data: {
            user: this.user.guid,
            position: this.user.position
        }
    };
};

module.exports = MoveMessage;