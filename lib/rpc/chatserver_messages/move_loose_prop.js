var util = require('util'),
    Log = require('../../util/log'),
    config = require('../../config'),
    MessageEncoder = require('../message_encoder'),
    Message = require('../message');
    
var logger = Log.getLogger('rpc.chatserver_messages.MoveLoosePropMessage');

var MoveLoosePropMessage = function(chatserver) {
    Message.call(this, chatserver);
    this.user = null;
    this.x = null;
    this.y = null;
    this.id = null;
};
util.inherits(MoveLoosePropMessage, Message);

MoveLoosePropMessage.messageId = "move_loose_prop";
MoveLoosePropMessage.acceptFromClient = true;

MoveLoosePropMessage.prototype.receive = function(message, user) {
    this._encodedMessage = null;
    this.user = user;
    if (message.data) {
        var data = message.data;
        if (user.currentRoom) {
            user.currentRoom.loosePropList.moveLooseProp(data.id, data.x, data.y, user);
        }
    }
};

MoveLoosePropMessage.prototype.send = function(user) {
    if (!this._encodedMessage) {
        this._encodedMessage = MessageEncoder.encode(this.getSerializableHash());
    }
    user.connection.send(this._encodedMessage);
};

MoveLoosePropMessage.prototype.getSerializableHash = function() {
    return {
        msg: MoveLoosePropMessage.messageId,
        data: {
            user: this.user.guid,
            id: this.id,
            x: this.x,
            y: this.y
        }
    };
};

module.exports = MoveLoosePropMessage;