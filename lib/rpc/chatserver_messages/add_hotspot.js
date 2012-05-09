var util = require('util'),
    Log = require('../../util/log'),
    config = require('../../config'),
    MessageEncoder = require('../message_encoder'),
    Message = require('../message'),
    Hotspot = require('../../model/hotspot');
    
var logger = Log.getLogger('rpc.chatserver_messages.AddHotspotMessage');

var guidRegexp = /^[\da-fA-F]{8}-[\da-fA-F]{4}-[\da-fA-F]{4}-[\da-fA-F]{4}-[\da-fA-F]{12}$/;

var AddHotspotMessage = function(chatserver) {
    Message.call(this, chatserver);
    this.user = null;
    this.hotspot = null;
    this._encodedMessage = null;
};
util.inherits(AddHotspotMessage, Message);

AddHotspotMessage.messageId = "add_hotspot";
AddHotspotMessage.acceptFromClient = true;

AddHotspotMessage.prototype.receive = function(message, user) {
    var self = this;
    this._encodedMessage = null;
    this.user = user;
    
    user.currentRoom.checkCanAuthor(this.user, function(err, result) {
        if (!result) {
            logger.error("Unauthorized attempt to add hotspot.", user.logNotation);
            return;
        }
        if (message.data) {
            if (message.data.points && !Array.isArray(message.data.points)) {
                logger.error("Data for 'add_hotspot' message is invalid.", user.logNotation);
                return;
            }
            var x = parseInt(message.data.x, 10);
            var y = parseInt(message.data.y, 10);

            if (isNaN(x) || isNaN(y)) {
                // Non-numeric inputs
                logger.error("User attempted to set non-numeric hotspot position.", user.logNotation);
                return;
            }
            
            if (!Array.isArray(message.data.points)) {
                logger.error("User attempted to add hotspot without a list of corner points.", user.logNotation);
                return;
            }
            
            for (var i = 0; i < message.data.points; i ++) {
                var point = message.data.points[i];
                if (point.length !== 2) {
                    logger.error("Invalid point data for new hotspot", user.logNotation);
                    return;
                }
            }
            
            if (message.data.dest) {
                if (typeof(message.data.dest) !== 'string') {
                    logger.error("Non-string provided for hotspot dest.", user.logNotation);
                    return;
                }
                if (!message.data.dest.match(guidRegexp)) {
                    logger.error("Invalid format provided for hotspot dest room guid.", user.logNotation);
                    return;
                }
            }

            self.hotspot = new Hotspot();
            self.hotspot.move(message.data.x, message.data.y);
            self.hotspot.setPoints(message.data.points);
            
            user.currentRoom.definition.items.push(self.hotspot);
            user.currentRoom.definition.save();

            user.currentRoom.broadcast(self);
        }
    });
};

AddHotspotMessage.prototype.send = function(user) {
    if (!this._encodedMessage) {
        this._encodedMessage = MessageEncoder.encode(this.getSerializableHash());
    }
    user.connection.send(this._encodedMessage);
};

AddHotspotMessage.prototype.getSerializableHash = function() {
    return {
        msg: AddHotspotMessage.messageId,
        data: this.hotspot
    };
};

module.exports = AddHotspotMessage;