var util = require('util'),
    Log = require('../../util/log'),
    config = require('../../config'),
    MessageEncoder = require('../message_encoder'),
    Message = require('../message');
    
var logger = Log.getLogger('rpc.chatserver_messages.MoveHotspotMessage');

var MoveHotspotMessage = function(chatserver) {
    Message.call(this, chatserver);
    this.user = null;
    this.hotspot = null;
    this._encodedMessage = null;
};
util.inherits(MoveHotspotMessage, Message);

MoveHotspotMessage.messageId = "move_hotspot";
MoveHotspotMessage.acceptFromClient = true;

MoveHotspotMessage.prototype.receive = function(message, user) {
    var self = this;
    this._encodedMessage = null;
    this.user = user;
    
    user.currentRoom.checkCanAuthor(this.user, function(err, result) {
        if (!result) {
            logger.error("Unauthorized attempt to move hotspot.", user.logNotation);
            return;
        }
        if (message.data) {
            if (message.data.points && !Array.isArray(message.data.points)) {
                logger.error("Data for 'move_hotspot' message is invalid.", user.logNotation);
                return;
            }
            var x = parseInt(message.data.x, 10);
            var y = parseInt(message.data.y, 10);

            if (typeof(message.data.guid) !== 'string') {
                logger.error("Hotspot guid must be specified as a string.");
                return;
            }

            if (isNaN(x) || isNaN(y)) {
                // Non-numeric inputs
                logger.warn("User attempted to set non-numeric hotspot position.", user.logNotation);
                return;
            }

            self.hotspot = user.currentRoom.definition.getItemByGuid(message.data.guid);
            if (self.hotspot && self.hotspot.type === 'hotspot') {
                self.hotspot.move(message.data.x, message.data.y);
                if (message.data.points) {
                    self.hotspot.setPoints(message.data.points);
                }
                user.currentRoom.definition.save();
            }

            user.currentRoom.broadcast(self, self.user.guid);
        }
    });
};

MoveHotspotMessage.prototype.send = function(user) {
    if (!this._encodedMessage) {
        this._encodedMessage = MessageEncoder.encode(this.getSerializableHash());
    }
    user.connection.send(this._encodedMessage);
};

MoveHotspotMessage.prototype.getSerializableHash = function() {
    return {
        msg: MoveHotspotMessage.messageId,
        data: this.hotspot
    };
};

module.exports = MoveHotspotMessage;