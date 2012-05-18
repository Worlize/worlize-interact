var util = require('util'),
    Log = require('../../util/log'),
    config = require('../../config'),
    MessageEncoder = require('../message_encoder'),
    Message = require('../message');
    
// For room definitions
var InWorldObjectInstance = require('../../model/room_definition/in_world_object_instance');

// For MySQL
var sequelize = require('../../model/sequelize_models');
    
var logger = Log.getLogger('rpc.chatserver_messages.AddObjectInstanceMessage');

var AddObjectInstanceMessage = function(chatserver) {
    Message.call(this, chatserver);
    this.user = null;
    this.guid = null;
    this.x = null
    this.y = null;
    this.inWorldObjectInstance = null;
    this._encodedMessage = null;
};
util.inherits(AddObjectInstanceMessage, Message);

AddObjectInstanceMessage.messageId = "add_object_instance";
AddObjectInstanceMessage.acceptFromClient = true;

AddObjectInstanceMessage.prototype.receive = function(message, user) {
    var self = this;
    this._encodedMessage = null;
    this.user = user;
    
    user.currentRoom.checkCanAuthor(this.user, function(err, result) {
        if (err) {
            logger.error("Unable to check whether the current user can author: " + err.toString, user.logNotation);
            return;
        }
        if (!result) {
            logger.error("Unauthorized attempt to add object instance.", user.logNotation);
            return;
        }
        if (message.data) {
            self.x = parseInt(message.data.x, 10);
            self.y = parseInt(message.data.y, 10);

            if (isNaN(self.x) || isNaN(self.y)) {
                // Non-numeric inputs
                logger.error("User attempted to set non-numeric object position.", user.logNotation);
                return;
            }
            
            if (!message.data.guid) {
                logger.error("User attempted to add object without specifying instance guid.", user.logNotation);
                return;
            }
            
            user.currentRoom.definition.addObjectInstance(
                message.data.guid,
                message.data.x,
                message.data.y,
                null,
                user,
                function(err, item) {
                    if (err) {
                        logger.error("Unable to add object instance to room: " + err.toString(), user.logNotation);
                        return;
                    }
                    self.inWorldObjectInstance = item;
                    user.currentRoom.broadcast(self);
                }
            );
        }
    });
};

AddObjectInstanceMessage.prototype.send = function(user) {
    if (!this._encodedMessage) {
        this._encodedMessage = MessageEncoder.encode(this.getSerializableHash());
    }
    user.connection.send(this._encodedMessage);
};

AddObjectInstanceMessage.prototype.getSerializableHash = function() {
    return {
        msg: AddObjectInstanceMessage.messageId,
        data: {
            room: this.user.currentRoom.guid,
            object: this.inWorldObjectInstance
        }
    };
};

module.exports = AddObjectInstanceMessage;