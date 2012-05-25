var util = require('util'),
    Log = require('../../util/log'),
    config = require('../../config'),
    MessageEncoder = require('../message_encoder'),
    Message = require('../message');
    
var logger = Log.getLogger('rpc.chatserver_messages.RemoveItemMessage');

var RemoveItemMessage = function(chatserver) {
    Message.call(this, chatserver);
    this.user = null;
    this.item = null;
    this._encodedMessage = null;
};
util.inherits(RemoveItemMessage, Message);

RemoveItemMessage.messageId = "remove_item";
RemoveItemMessage.acceptFromClient = true;

RemoveItemMessage.prototype.receive = function(message, user) {
    var self = this;
    this._encodedMessage = null;
    this.user = user;
    
    user.currentRoom.checkCanAuthor(this.user, function(err, result) {
        if (!result) {
            logger.error("Unauthorized attempt to remove item.", user.logNotation);
            return;
        }
        if (message.data) {
            if (typeof(message.data.guid) !== 'string') {
                logger.error("Item guid must be specified as a string.", user.logNotation);
                return;
            }
            
            self.item = user.currentRoom.definition.getItemByGuid(message.data.guid);
            if (self.item.type === 'object') {
                user.currentRoom.definition.removeObjectInstance(message.data.guid, false, itemRemoveComplete);
            }
            else {
                var item = user.currentRoom.definition.removeItem(message.data.guid);
                itemRemoveComplete(null, item);
            }
            
            function itemRemoveComplete(err, result) {
                self.item = result;
                if (self.item) {
                    user.currentRoom.definition.save(function(err, result) {
                        if (err) {
                            logger.error("room=" + user.currentRoom.guid + " Unable to save room definition: " + err.toString(), user.logNotation);
                            return;
                        }
                        user.currentRoom.broadcast(self);
                    });
                }
            }
        }
    });
};

RemoveItemMessage.prototype.send = function(user) {
    if (!this._encodedMessage) {
        this._encodedMessage = MessageEncoder.encode(this.getSerializableHash());
    }
    user.connection.send(this._encodedMessage);
};

RemoveItemMessage.prototype.getSerializableHash = function() {
    return {
        msg: RemoveItemMessage.messageId,
        data: {
            guid: this.item.guid
        }
    };
};

module.exports = RemoveItemMessage;