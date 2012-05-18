var util = require('util'),
    Log = require('../../util/log'),
    config = require('../../config'),
    MessageEncoder = require('../message_encoder'),
    Message = require('../message');
    
var logger = Log.getLogger('rpc.chatserver_messages.RemoveHotspotMessage');

var RemoveHotspotMessage = function(chatserver) {
    Message.call(this, chatserver);
    this.user = null;
    this._encodedMessage = null;
};
util.inherits(RemoveHotspotMessage, Message);

RemoveHotspotMessage.messageId = "remove_hotspot";
RemoveHotspotMessage.acceptFromClient = true;

RemoveHotspotMessage.prototype.receive = function(message, user) {
    var self = this;
    this._encodedMessage = null;
    this.user = user;
    
    user.currentRoom.checkCanAuthor(this.user, function(err, result) {
        if (!result) {
            logger.error("Unauthorized attempt to remove hotspot.", user.logNotation);
            return;
        }
        if (message.data) {
            if (typeof(message.data.guid) !== 'string') {
                logger.error("Hotspot guid must be specified as a string.", user.logNotation);
                return;
            }
            
            self.hotspot = user.currentRoom.definition.removeItem(message.data.guid);
            
            if (self.hotspot) {
                user.currentRoom.definition.save();
                user.currentRoom.broadcast(self);
            }
        }
    });
};

RemoveHotspotMessage.prototype.send = function(user) {
    if (!this._encodedMessage) {
        this._encodedMessage = MessageEncoder.encode(this.getSerializableHash());
    }
    user.connection.send(this._encodedMessage);
};

RemoveHotspotMessage.prototype.getSerializableHash = function() {
    return {
        msg: RemoveHotspotMessage.messageId,
        data: {
            guid: this.hotspot.guid
        }
    };
};

module.exports = RemoveHotspotMessage;