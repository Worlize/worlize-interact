var util = require('util'),
    Log = require('../../util/log'),
    config = require('../../config'),
    MessageEncoder = require('../message_encoder'),
    Message = require('../message');
    
// For MySQL
var sequelize = require('../../model/sequelize_models');
    
var logger = Log.getLogger('rpc.chatserver_messages.MoveObjectInstanceMessage');

var MoveObjectInstanceMessage = function(chatserver) {
    Message.call(this, chatserver);
    this.user = null;
    this.guid = null;
    this.x = null;
    this.y = null;
    this._encodedMessage = null;
};
util.inherits(MoveObjectInstanceMessage, Message);

MoveObjectInstanceMessage.messageId = "move_object_instance";
MoveObjectInstanceMessage.acceptFromClient = true;

MoveObjectInstanceMessage.prototype.receive = function(message, user) {
    var self = this;
    this._encodedMessage = null;
    this.user = user;
    
    user.currentRoom.checkCanAuthor(this.user, function(err, result) {
        if (err) {
            logger.error("Unable to check whether the current user can author: " + err.toString, user.logNotation);
            return;
        }
        if (!result) {
            logger.error("Unauthorized attempt to move object instance.", user.logNotation);
            return;
        }
        
        if (message.data) {
            if (!message.data.guid) {
                logger.error("User attempted to move object without specifying instance guid.", user.logNotation);
                return;
            }

            self.guid = message.data.guid;
            self.x = parseInt(message.data.x, 10);
            self.y = parseInt(message.data.y, 10);

            if (isNaN(self.x) || isNaN(self.y)) {
                // Non-numeric inputs
                logger.error("User attempted to set non-numeric object position.", user.logNotation);
                return;
            }
            
            var definition = user.currentRoom.definition;
            var item = definition.getItemByGuid(self.guid);
            if (!item) {
                logger.error("The specified object instance is not in this room.", user.logNotation);
                return;
            }

            if (item.type !== 'object') {
                logger.error("The specified item is not an object.", user.logNotation);
                return;
            }

            item.x = self.x;
            item.y = self.y;

            definition.save(function(err, item) {
                if (err) {
                    logger.error("Unable to move object instance: " + err.toString(), user.logNotation);
                    return;
                }
                user.currentRoom.broadcast(self);
            });
        }
    });
};

MoveObjectInstanceMessage.prototype.send = function(user) {
    if (!this._encodedMessage) {
        this._encodedMessage = MessageEncoder.encode(this.getSerializableHash());
    }
    user.connection.send(this._encodedMessage);
};

MoveObjectInstanceMessage.prototype.getSerializableHash = function() {
    return {
        msg: MoveObjectInstanceMessage.messageId,
        data: {
            room: this.user.currentRoom.guid,
            guid: this.guid,
            x: this.x,
            y: this.y
        }
    };
};

module.exports = MoveObjectInstanceMessage;