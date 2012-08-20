var util = require('util'),
    Log = require('../../util/log'),
    config = require('../../config'),
    MessageEncoder = require('../message_encoder'),
    Message = require('../message');
    
var logger = Log.getLogger('rpc.chatserver_messages.UserRestrictionsChangedMessage');

var UserRestrictionsChangedMessage = function(chatserver) {
    Message.call(this, chatserver);
    this.user = null;
    this.room = null;
};
util.inherits(UserRestrictionsChangedMessage, Message);

UserRestrictionsChangedMessage.messageId = "user_restrictions_changed";
UserRestrictionsChangedMessage.acceptFromClient = false;

UserRestrictionsChangedMessage.prototype.send = function(user) {
    if (!this._encodedMessage) {
        this._encodedMessage = MessageEncoder.encode(this.getSerializableHash());
    }
    user.connection.send(this._encodedMessage);
};

UserRestrictionsChangedMessage.prototype.getSerializableHash = function() {
    if (!this.room.definition) {
        throw new Error("Room not ready, unable to get serializable hash for user_restrictions_changed message.");
    }
    return {
        msg: UserRestrictionsChangedMessage.messageId,
        data: {
            user: this.user.guid,
            restrictions: this.user.restrictions
        }
    };
};

module.exports = UserRestrictionsChangedMessage;