var util = require('util'),
    Log = require('../../util/log'),
    config = require('../../config'),
    MessageEncoder = require('../message_encoder'),
    Message = require('../message');
    
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
    this._encodedMessage = null;
    this.user = user;
    if (message.data) {
        var data = message.data;
        if (user.currentRoom) {
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
            user: this.user.guid,
            id: this.id,
            x: this.x,
            y: this.y,
            prop: this.prop.getSerializableHash()
        }
    };
};

module.exports = AddLoosePropMessage;