var util = require('util'),
    Log = require('../../util/log'),
    config = require('../../config'),
    MessageEncoder = require('../message_encoder'),
    Message = require('../message');
    
var logger = Log.getLogger('rpc.chatserver_messages.SetObjectInstanceDestMessage');

var SetObjectInstanceDestMessage = function(chatserver) {
    Message.call(this, chatserver);
    this.user = null;
    this.objectInstance = null;
    this._encodedMessage = null;
};
util.inherits(SetObjectInstanceDestMessage, Message);

SetObjectInstanceDestMessage.messageId = "set_object_instance_dest";
SetObjectInstanceDestMessage.acceptFromClient = true;

SetObjectInstanceDestMessage.prototype.receive = function(message, user) {
    var self = this;
    this._encodedMessage = null;
    this.user = user;
    
    user.currentRoom.checkCanAuthor(this.user, function(err, result) {
        if (!result) {
            logger.error("Unauthorized attempt to move hotspot.", user.logNotation);
            return;
        }
        if (message.data) {
            self.objectInstance = user.currentRoom.definition.getItemByGuid(message.data.guid);
            
            if (self.objectInstance && self.objectInstance.type === 'object') {
                try {
                    self.objectInstance.setDest(message.data.destGuid);
                }
                catch(e) {
                    logger.error(e.toString(), user.logNotation);
                    return;
                }
                
                user.currentRoom.definition.save(function(err) {
                    if (err) {
                        logger.error(err);
                        return;
                    }
                    user.currentRoom.broadcast(self);
                });
            }
        }
    });
};

SetObjectInstanceDestMessage.prototype.send = function(user) {
    if (!this._encodedMessage) {
        this._encodedMessage = MessageEncoder.encode(this.getSerializableHash());
    }
    user.connection.send(this._encodedMessage);
};

SetObjectInstanceDestMessage.prototype.getSerializableHash = function() {
    return {
        msg: SetObjectInstanceDestMessage.messageId,
        data: {
            room: this.user.currentRoom.guid,
            object: this.objectInstance.guid,
            dest: this.objectInstance.dest
        }
    };
};

module.exports = SetObjectInstanceDestMessage;