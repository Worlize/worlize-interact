var util = require('util'),
    Log = require('../../util/log'),
    MessageEncoder = require('../message_encoder'),
    Message = require('../message');
    
var logger = Log.getLogger('rpc.chatserver_messages.SaveAppConfigMessage');
    
var Msg = function(chatserver) {
    Message.call(this, chatserver);
    this.user = null;
    this.config = null;
    this.appInstanceGuid = null;
    this._encodedMessage = null;
};
util.inherits(Msg, Message);

Msg.messageId = "save_app_config";
Msg.acceptFromClient = true;

Msg.prototype.receive = function(message, user) {
    this._encodedMessage = null;
    this.user = user;
    if (user.currentRoom && user.currentRoom.definition) {
        if (user.guid !== user.currentRoom.definition.ownerGuid) {
            logger.warn("action=unauthorized User attempted unauthorized change to app config.", user.logNotation);
            return;
        }
        if (message.data && message.data.app_instance_guid && message.data.config) {
            this.appInstanceGuid = message.data.app_instance_guid;
            this.config = message.data.config;
            user.currentRoom.definition.updateAppConfig(this.appInstanceGuid, this.config);
            user.currentRoom.broadcast(this);
        }
    }
};

Msg.prototype.send = function(user) {
    if (!this._encodedMessage) {
        this._encodedMessage = MessageEncoder.encode(this.getSerializableHash());
    }
    user.connection.send(this._encodedMessage);
};

Msg.prototype.getSerializableHash = function() {
    return {
        msg: Msg.messageId,
        data: {
            user: this.user.guid,
            app_instance_guid: this.appInstanceGuid,
            config: this.config
        }
    };
};

module.exports = Msg;