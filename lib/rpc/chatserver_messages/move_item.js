var util = require('util'),
    Log = require('../../util/log'),
    config = require('../../config'),
    MessageEncoder = require('../message_encoder'),
    Message = require('../message');
    
var logger = Log.getLogger('rpc.chatserver_messages.MoveItemMessage');

var MoveItemMessage = function(chatserver) {
    Message.call(this, chatserver);
    this.user = null;
    this.item = null;
    this._encodedMessage = null;
};
util.inherits(MoveItemMessage, Message);

MoveItemMessage.messageId = "move_item";
MoveItemMessage.acceptFromClient = true;

MoveItemMessage.prototype.receive = function(message, user) {
    var self = this;
    this._encodedMessage = null;
    this.user = user;
    
    user.currentRoom.checkCanAuthor(this.user, function(err, result) {
        if (!result) {
            logger.error("Unauthorized attempt to move item.", user.logNotation);
            return;
        }
        if (message.data) {
            var x = parseInt(message.data.x, 10);
            var y = parseInt(message.data.y, 10);

            if (typeof(message.data.guid) !== 'string') {
                logger.error("Item guid must be specified as a string.");
                return;
            }

            if (isNaN(x) || isNaN(y)) {
                // Non-numeric inputs
                logger.warn("User attempted to set non-numeric item position.", user.logNotation);
                return;
            }

            self.item = user.currentRoom.definition.getItemByGuid(message.data.guid);
            if (self.item) {
                if ('setPoints' in self.item && message.data.points && !Array.isArray(message.data.points)) {
                    logger.error("Points data for 'move_item' message is invalid.", user.logNotation);
                    return;
                }
                
                if (!('move' in self.item)) {
                    logger.error("Tried to move non-movable room item", user.logNotation);
                    return;
                }
                
                try {
                    self.item.move(message.data.x, message.data.y);
                    if (message.data.points && 'setPoints' in self.item) {
                        self.item.setPoints(message.data.points);
                    }
                }
                catch(e) {
                    logger.error(e.toString(), user.logNotation);
                    return;
                }
                
                user.currentRoom.definition.save(function(err, result) {
                    if (err) {
                        logger.error("room=" + user.currentRoom.guid + " Unable to save room definition: " + err.toString(), user.logNotation);
                        return;
                    }
                    user.currentRoom.broadcast(self);
                });
            }
        }
    });
};

MoveItemMessage.prototype.send = function(user) {
    if (!this._encodedMessage) {
        this._encodedMessage = MessageEncoder.encode(this.getSerializableHash());
    }
    user.connection.send(this._encodedMessage);
};

MoveItemMessage.prototype.getSerializableHash = function() {
    var itemData = {
        guid: this.item.guid,
        x: this.item.x,
        y: this.item.y
    };
    if ('points' in this.item) {
        itemData.points = this.item.points;
    }
    if ('width' in this.item && 'height' in this.item) {
        itemData.width = this.item.width;
        itemData.height = this.item.height;
    }
    return {
        msg: MoveItemMessage.messageId,
        data: itemData
    };
};

module.exports = MoveItemMessage;