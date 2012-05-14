var util = require('util'),
    Log = require('../../util/log'),
    config = require('../../config'),
    MessageEncoder = require('../message_encoder'),
    Message = require('../message');
    
// For MySQL
var sequelize = require('../../model/sequelize_models');
    
var logger = Log.getLogger('rpc.chatserver_messages.SetBackgroundInstanceMessage');

var SetBackgroundInstanceMessage = function(chatserver) {
    Message.call(this, chatserver);
    this.user = null;
    this.guid = null;
    this.background = null;
    this.newBackgroundInstance = null;
    this.oldBackgroundInstance = null;
    this._encodedMessage = null;
};
util.inherits(SetBackgroundInstanceMessage, Message);

SetBackgroundInstanceMessage.messageId = "set_background_instance";
SetBackgroundInstanceMessage.acceptFromClient = true;

SetBackgroundInstanceMessage.prototype.receive = function(message, user) {
    var self = this;
    this._encodedMessage = null;
    this.user = user;
    
    user.currentRoom.checkCanAuthor(this.user, function(err, result) {
        if (err) {
            logger.error("Unable to check whether the current user can author: " + err.toString, user.logNotation);
            return;
        }
        if (!result) {
            logger.error("Unauthorized attempt to set room background.", user.logNotation);
            return;
        }
        if (message.data) {
            if (!message.data.guid) {
                logger.error("User attempted to set background without specifying instance guid.", user.logNotation);
                return;
            }
            
            user.currentRoom.definition.setBackgroundInstance(
                message.data.guid,
                user,
                function(err, background, newBackgroundInstance, oldBackgroundInstance) {
                    if (err) {
                        logger.error("Unable to set background in room: " + err.toString(), user.logNotation);
                        return;
                    }
                    self.background = background;
                    self.newBackgroundInstance = newBackgroundInstance;
                    self.oldBackgroundInstance = oldBackgroundInstance;
                    user.currentRoom.broadcast(self);
                }
            );
        }
    });
};

SetBackgroundInstanceMessage.prototype.send = function(user) {
    if (!this._encodedMessage) {
        this._encodedMessage = MessageEncoder.encode(this.getSerializableHash());
    }
    user.connection.send(this._encodedMessage);
};

SetBackgroundInstanceMessage.prototype.getSerializableHash = function() {
    var data = {
        room: this.user.currentRoom.guid,
        background: this.background,
    };
    if (this.newBackgroundInstance) {
        data.background_instance_guid = this.newBackgroundInstance.guid;
    }
    if (this.oldBackgroundInstance) {
        data.old_background_instance_guid = this.oldBackgroundInstance.guid;
    }
    return {
        msg: SetBackgroundInstanceMessage.messageId,
        data: data
    };
};

module.exports = SetBackgroundInstanceMessage;