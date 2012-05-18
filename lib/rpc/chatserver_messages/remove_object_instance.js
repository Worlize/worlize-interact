var util = require('util'),
    Log = require('../../util/log'),
    config = require('../../config'),
    MessageEncoder = require('../message_encoder'),
    Message = require('../message');
    
// For MySQL
var sequelize = require('../../model/sequelize_models');
    
var logger = Log.getLogger('rpc.chatserver_messages.RemoveObjectInstanceMessage');

var RemoveObjectInstanceMessage = function(chatserver) {
    Message.call(this, chatserver);
    this.user = null;
    this.guid = null;
    this._encodedMessage = null;
};
util.inherits(RemoveObjectInstanceMessage, Message);

RemoveObjectInstanceMessage.messageId = "remove_object_instance";
RemoveObjectInstanceMessage.acceptFromClient = true;

RemoveObjectInstanceMessage.prototype.receive = function(message, user) {
    var self = this;
    this._encodedMessage = null;
    this.user = user;
    
    user.currentRoom.checkCanAuthor(this.user, function(err, result) {
        if (err) {
            logger.error("Unable to check whether the current user can author: " + err.toString, user.logNotation);
            return;
        }
        if (!result) {
            logger.error("Unauthorized attempt to remove object instance.", user.logNotation);
            return;
        }
        if (message.data) {
            if (!message.data.guid) {
                logger.error("User attempted to remove object without specifying instance guid.", user.logNotation);
                return;
            }
            
            self.guid = message.data.guid;
            
            user.currentRoom.definition.removeObjectInstance(
                self.guid,
                function(err, item) {
                    if (err) {
                        logger.error("Unable to remove object instance from room: " + err.toString(), user.logNotation);
                        return;
                    }
                    user.currentRoom.broadcast(self);
                }
            );
        }
    });
};

RemoveObjectInstanceMessage.prototype.send = function(user) {
    if (!this._encodedMessage) {
        this._encodedMessage = MessageEncoder.encode(this.getSerializableHash());
    }
    user.connection.send(this._encodedMessage);
};

RemoveObjectInstanceMessage.prototype.getSerializableHash = function() {
    return {
        msg: RemoveObjectInstanceMessage.messageId,
        data: {
            room: this.user.currentRoom.guid,
            guid: this.guid
        }
    };
};

module.exports = RemoveObjectInstanceMessage;