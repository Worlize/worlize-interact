var util = require('util'),
    Log = require('../../util/log'),
    config = require('../../config'),
    MessageEncoder = require('../message_encoder'),
    Message = require('../message'),
    RoomMsgMessage = require('./room_msg');
    
var logger = Log.getLogger('rpc.chatserver_messages.BringLoosePropForwardMessage');

var BringLoosePropForwardMessage = function(chatserver) {
    Message.call(this, chatserver);
    this.user = null;
    this.id = null;
    this.layerCount = 0;
};
util.inherits(BringLoosePropForwardMessage, Message);

BringLoosePropForwardMessage.messageId = "bring_loose_prop_forward";
BringLoosePropForwardMessage.acceptFromClient = true;

BringLoosePropForwardMessage.prototype.receive = function(message, user) {
    if (user.hasActiveRestriction('block_props')) {
        var roomMsg = new RoomMsgMessage();
        roomMsg.text = "A moderator has revoked your ability to move props.";
        roomMsg.user = user;
        user.sendMessage(roomMsg);
        return;
    }
    
    this._encodedMessage = null;
    this.user = user;
    if (message.data) {
        var data = message.data;
        if (user.currentRoom) {
            user.currentRoom.loosePropList.bringForward(data.id, data.layerCount, user);
        }
    }
};

BringLoosePropForwardMessage.prototype.send = function(user) {
    if (!this._encodedMessage) {
        this._encodedMessage = MessageEncoder.encode(this.getSerializableHash());
    }
    user.connection.send(this._encodedMessage);
};

BringLoosePropForwardMessage.prototype.getSerializableHash = function() {
    return {
        msg: BringLoosePropForwardMessage.messageId,
        data: {
            user: this.user.guid,
            id: this.id,
            layerCount: this.layerCount
        }
    };
};

module.exports = BringLoosePropForwardMessage;