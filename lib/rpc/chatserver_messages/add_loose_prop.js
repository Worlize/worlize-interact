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
    this.propGuid = null;
};
util.inherits(AddLoosePropMessage, Message);

AddLoosePropMessage.messageId = "add_loose_prop";
AddLoosePropMessage.acceptFromClient = true;

AddLoosePropMessage.prototype.receive = function(message, user) {
    this.user = user;
    if (message.data) {
        if (user.currentRoom) {
            user.currentRoom.loosePropsStore.addLooseProp(data.x, data.y, data.guid, user);
        }
    }
};

AddLoosePropMessage.prototype.send = function(user) {
    user.connection.send(MessageEncoder.encode(this.getSerializableHash()));
};

AddLoosePropMessage.prototype.getSerializableHash = function() {
    return {
        msg: AddLoosePropMessage.messageId,
        data: {
            user: this.user.guid
        }
    };
};

module.exports = AddLoosePropMessage;