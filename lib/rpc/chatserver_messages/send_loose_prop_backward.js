var util = require('util'),
    Log = require('../../util/log'),
    config = require('../../config'),
    MessageEncoder = require('../message_encoder'),
    Message = require('../message');
    
var logger = Log.getLogger('rpc.chatserver_messages.SendLoosePropBackwardMessage');

var SendLoosePropBackwardMessage = function(chatserver) {
    Message.call(this, chatserver);
    this.user = null;
    this.id = null;
    this.layerCount = 0;
};
util.inherits(SendLoosePropBackwardMessage, Message);

SendLoosePropBackwardMessage.messageId = "send_loose_prop_backward";
SendLoosePropBackwardMessage.acceptFromClient = true;

SendLoosePropBackwardMessage.prototype.receive = function(message, user) {
    this._encodedMessage = null;
    this.user = user;
    if (message.data) {
        var data = message.data;
        if (user.currentRoom) {
            user.currentRoom.loosePropList.sendBackward(data.id, data.layerCount, user);
        }
    }
};

SendLoosePropBackwardMessage.prototype.send = function(user) {
    if (!this._encodedMessage) {
        this._encodedMessage = MessageEncoder.encode(this.getSerializableHash());
    }
    user.connection.send(this._encodedMessage);
};

SendLoosePropBackwardMessage.prototype.getSerializableHash = function() {
    return {
        msg: SendLoosePropBackwardMessage.messageId,
        data: {
            user: this.user.guid,
            id: this.id,
            layerCount: this.layerCount
        }
    };
};

module.exports = SendLoosePropBackwardMessage;