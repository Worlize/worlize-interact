var util = require('util'),
    Log = require('../../util/log'),
    config = require('../../config'),
    MessageEncoder = require('../message_encoder'),
    Message = require('../message');
    
var logger = Log.getLogger('rpc.chatserver_messages.ClearLoosePropsMessage');

var ClearLoosePropsMessage = function(chatserver) {
    Message.call(this, chatserver);
    this.user = null;
    this.x = null;
    this.y = null;
    this.id = null;
    this.guid = null;
};
util.inherits(ClearLoosePropsMessage, Message);

ClearLoosePropsMessage.messageId = "clear_loose_props";
ClearLoosePropsMessage.acceptFromClient = true;

ClearLoosePropsMessage.prototype.receive = function(message, user) {
    this._encodedMessage = null;
    this.user = user;
    if (user.currentRoom) {
        user.currentRoom.loosePropList.clearLooseProps(user);
    }
};

ClearLoosePropsMessage.prototype.send = function(user) {
    if (!this._encodedMessage) {
        this._encodedMessage = MessageEncoder.encode(this.getSerializableHash());
    }
    user.connection.send(this._encodedMessage);
};

ClearLoosePropsMessage.prototype.getSerializableHash = function() {
    var obj = {
        msg: ClearLoosePropsMessage.messageId,
        data: {
            user: null
        }
    }
    if (this.user) {
        obj['user'] = this.user.guid;
    }
    return obj;
};

module.exports = ClearLoosePropsMessage;