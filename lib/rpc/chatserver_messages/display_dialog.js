var util = require('util'),
    Log = require('../../util/log'),
    config = require('../../config'),
    MessageEncoder = require('../message_encoder'),
    Message = require('../message');
    
var logger = Log.getLogger('rpc.chatserver_messages.DisplayDialogMessage');

var DisplayDialogMessage = function(chatserver) {
    Message.call(this, chatserver);
    this.message = null;
    this.title = "Worlize";
};
util.inherits(DisplayDialogMessage, Message);

DisplayDialogMessage.messageId = "display_dialog";
DisplayDialogMessage.acceptFromClient = false;


DisplayDialogMessage.prototype.send = function(user) {
    user.connection.send(MessageEncoder.encode(this.getSerializableHash()));
};

DisplayDialogMessage.prototype.getSerializableHash = function() {
    return {
        msg: DisplayDialogMessage.messageId,
        data: {
            title: this.title,
            message: this.message
        }
    };
};

module.exports = DisplayDialogMessage;