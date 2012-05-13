var util = require('util'),
    Log = require('../../util/log'),
    config = require('../../config'),
    MessageEncoder = require('../message_encoder'),
    Message = require('../message');
    
var logger = Log.getLogger('rpc.chatserver_messages.SetHotspotDestMessage');

var SetHotspotDestMessage = function(chatserver) {
    Message.call(this, chatserver);
    this.user = null;
    this.hotspot = null;
    this._encodedMessage = null;
};
util.inherits(SetHotspotDestMessage, Message);

SetHotspotDestMessage.messageId = "set_hotspot_dest";
SetHotspotDestMessage.acceptFromClient = true;

SetHotspotDestMessage.prototype.receive = function(message, user) {
    var self = this;
    this._encodedMessage = null;
    this.user = user;
    
    user.currentRoom.checkCanAuthor(this.user, function(err, result) {
        if (!result) {
            logger.error("Unauthorized attempt to move hotspot.", user.logNotation);
            return;
        }
        if (message.data) {
            self.hotspot = user.currentRoom.definition.getItemByGuid(message.data.guid);
            
            if (self.hotspot && self.hotspot.type === 'hotspot') {
                try {
                    self.hotspot.setDest(message.data.destGuid);
                }
                catch(e) {
                    logger.error(e.toString(), user.logNotation);
                    return;
                }
                
                user.currentRoom.definition.save();
                user.currentRoom.broadcast(self);
            }
        }
    });
};

SetHotspotDestMessage.prototype.send = function(user) {
    if (!this._encodedMessage) {
        this._encodedMessage = MessageEncoder.encode(this.getSerializableHash());
    }
    user.connection.send(this._encodedMessage);
};

SetHotspotDestMessage.prototype.getSerializableHash = function() {
    return {
        msg: SetHotspotDestMessage.messageId,
        data: {
            guid: this.hotspot.guid,
            dest: this.hotspot.dest
        }
    };
};

module.exports = SetHotspotDestMessage;