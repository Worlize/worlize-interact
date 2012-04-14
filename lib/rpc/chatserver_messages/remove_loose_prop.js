var util = require('util'),
    Log = require('../../util/log'),
    config = require('../../config'),
    MessageEncoder = require('../message_encoder'),
    Message = require('../message');
    
var logger = Log.getLogger('rpc.chatserver_messages.RemoveLoosePropMessage');

var RemoveLoosePropMessage = function(chatserver) {
    Message.call(this, chatserver);
    this.user = null;
    this.x = null;
    this.y = null;
    this.id = null;
};
util.inherits(RemoveLoosePropMessage, Message);

RemoveLoosePropMessage.messageId = "remove_loose_prop";
RemoveLoosePropMessage.acceptFromClient = true;

RemoveLoosePropMessage.prototype.receive = function(message, user) {
    this._encodedMessage = null;
    this.user = user;
    if (message.data) {
        var data = message.data;
        if (user.currentRoom) {
            user.currentRoom.loosePropList.removeLooseProp(data.id, user);
        }
    }
};

RemoveLoosePropMessage.prototype.send = function(user) {
    if (!this._encodedMessage) {
        this._encodedMessage = MessageEncoder.encode(this.getSerializableHash());
    }
    user.connection.send(this._encodedMessage);
};

RemoveLoosePropMessage.prototype.getSerializableHash = function() {
    return {
        msg: RemoveLoosePropMessage.messageId,
        data: {
            user: this.user.guid,
            id: this.id
        }
    };
};

module.exports = RemoveLoosePropMessage;