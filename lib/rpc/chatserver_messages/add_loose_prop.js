var util = require('util'),
    Log = require('../../util/log'),
    config = require('../../config'),
    MessageEncoder = require('../message_encoder'),
    Message = require('../message'),
    RoomMsgMessage = require('./room_msg');
    
var logger = Log.getLogger('rpc.chatserver_messages.AddLoosePropMessage');

var AddLoosePropMessage = function(chatserver) {
    Message.call(this, chatserver);
    this.user = null;
    this.x = null;
    this.y = null;
    this.id = null;
    this.guid = null;
};
util.inherits(AddLoosePropMessage, Message);

AddLoosePropMessage.messageId = "add_loose_prop";
AddLoosePropMessage.acceptFromClient = true;

AddLoosePropMessage.prototype.receive = function(message, user) {
    var roomMsg;
    
    if (user.hasActiveRestriction('block_props')) {
        roomMsg = new RoomMsgMessage();
        roomMsg.text = "A moderator has revoked your ability to drop props.";
        roomMsg.user = user;
        user.sendMessage(roomMsg);
        return;
    }
    
    this._encodedMessage = null;
    this.user = user;
    if (message.data) {
        var data = message.data;
        if (user.currentRoom) {
            // Check to see if props are allowed in the current room
            if (user.currentRoom.definition.properties.noProps) {
                roomMsg = new RoomMsgMessage();
                roomMsg.text = "Props are not allowed in this room.";
                roomMsg.user = user;
                user.sendMessage(roomMsg);
                return;
            }
            user.currentRoom.loosePropList.addLooseProp(data.x, data.y, data.guid, user);
        }
    }
};

AddLoosePropMessage.prototype.send = function(user) {
    if (!this._encodedMessage) {
        this._encodedMessage = MessageEncoder.encode(this.getSerializableHash());
    }
    user.connection.send(this._encodedMessage);
};

AddLoosePropMessage.prototype.getSerializableHash = function() {
    return {
        msg: AddLoosePropMessage.messageId,
        data: {
            user: {
                guid: this.user.guid,
                name: this.user.userName
            },
            id: this.id,
            x: this.x,
            y: this.y,
            prop: this.prop.getSerializableHash()
        }
    };
};

module.exports = AddLoosePropMessage;