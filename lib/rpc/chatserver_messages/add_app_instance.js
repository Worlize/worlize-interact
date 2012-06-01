var util = require('util'),
    Log = require('../../util/log'),
    config = require('../../config'),
    MessageEncoder = require('../message_encoder'),
    Message = require('../message');
    
var logger = Log.getLogger('rpc.chatserver_messages.AddAppInstanceMessage');

var AddAppInstanceMessage = function(chatserver) {
    Message.call(this, chatserver);
    this.user = null;
    this.guid = null;
    this.x = null
    this.y = null;
    this.app = null;
    this._encodedMessage = null;
};
util.inherits(AddAppInstanceMessage, Message);

AddAppInstanceMessage.messageId = "add_app_instance";
AddAppInstanceMessage.acceptFromClient = true;

AddAppInstanceMessage.prototype.receive = function(message, user) {
    var self = this;
    this._encodedMessage = null;
    this.user = user;
    
    user.currentRoom.checkCanAuthor(this.user, function(err, result) {
        if (err) {
            logger.error("Unable to check whether the current user can author: " + err.toString, user.logNotation);
            return;
        }
        if (!result) {
            logger.error("Unauthorized attempt to add app instance.", user.logNotation);
            return;
        }
        if (message.data) {
            self.x = parseInt(message.data.x, 10);
            self.y = parseInt(message.data.y, 10);

            if (isNaN(self.x) || isNaN(self.y)) {
                // Non-numeric inputs
                logger.error("User attempted to set non-numeric app position.", user.logNotation);
                return;
            }
            
            if (!message.data.guid) {
                logger.error("User attempted to add app without specifying instance guid.", user.logNotation);
                return;
            }
            
            user.currentRoom.definition.addAppInstance(
                message.data.guid,
                message.data.x,
                message.data.y,
                null,
                user,
                function(err, item) {
                    if (err) {
                        logger.error("Unable to add app instance to room: " + err.toString(), user.logNotation);
                        return;
                    }
                    self.app = item;
                    user.currentRoom.broadcast(self);
                }
            );
        }
    });
};

AddAppInstanceMessage.prototype.send = function(user) {
    if (!this._encodedMessage) {
        this._encodedMessage = MessageEncoder.encode(this.getSerializableHash());
    }
    user.connection.send(this._encodedMessage);
};

AddAppInstanceMessage.prototype.getSerializableHash = function() {
    return {
        msg: AddAppInstanceMessage.messageId,
        data: {
            room: this.user.currentRoom.guid,
            app: this.app
        }
    };
};

module.exports = AddAppInstanceMessage;