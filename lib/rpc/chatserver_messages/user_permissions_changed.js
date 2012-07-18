var util = require('util'),
    Log = require('../../util/log'),
    config = require('../../config'),
    MessageEncoder = require('../message_encoder'),
    Message = require('../message');
    
var logger = Log.getLogger('rpc.chatserver_messages.UserPermissionsChangedMessage');

var UserPermissionsChangedMessage = function(chatserver) {
    Message.call(this, chatserver);
    this.user = null;
};
util.inherits(UserPermissionsChangedMessage, Message);

UserPermissionsChangedMessage.messageId = "user_permissions_changed";
UserPermissionsChangedMessage.acceptFromClient = false;

UserPermissionsChangedMessage.prototype.send = function(user) {
    if (!this._encodedMessage) {
        this._encodedMessage = MessageEncoder.encode(this.getSerializableHash());
    }
    user.connection.send(this._encodedMessage);
};

UserPermissionsChangedMessage.prototype.getSerializableHash = function() {
    return {
        msg: UserPermissionsChangedMessage.messageId,
        data: {
            user: this.user.guid,
            permissions: this.user.getPermissionNames()
        }
    };
};

module.exports = UserPermissionsChangedMessage;