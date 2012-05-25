var util = require('util'),
    Log = require('../../util/log'),
    config = require('../../config'),
    MessageEncoder = require('../message_encoder'),
    Message = require('../message');
    
var logger = Log.getLogger('rpc.chatserver_messages.SetDestMessage');

var SetDestMessage = function(chatserver) {
    Message.call(this, chatserver);
    this.user = null;
    this.item = null;
    this._encodedMessage = null;
};
util.inherits(SetDestMessage, Message);

SetDestMessage.messageId = "set_dest";
SetDestMessage.acceptFromClient = true;

SetDestMessage.prototype.receive = function(message, user) {
    var self = this;
    this._encodedMessage = null;
    this.user = user;
    
    user.currentRoom.checkCanAuthor(this.user, function(err, result) {
        if (!result) {
            logger.error("Unauthorized attempt to set item destination.", user.logNotation);
            return;
        }
        if (message.data) {
            self.item = user.currentRoom.definition.getItemByGuid(message.data.guid);
            
            if (self.item) {
                if (!('setDest' in self.item)) {
                    logger.error("User tried to set destination on non-linkable room item.");
                    return;
                }
                
                try {
                    self.item.setDest(message.data.destGuid);
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

SetDestMessage.prototype.send = function(user) {
    if (!this._encodedMessage) {
        this._encodedMessage = MessageEncoder.encode(this.getSerializableHash());
    }
    user.connection.send(this._encodedMessage);
};

SetDestMessage.prototype.getSerializableHash = function() {
    return {
        msg: SetDestMessage.messageId,
        data: {
            guid: this.item.guid,
            dest: this.item.dest
        }
    };
};

module.exports = SetDestMessage;