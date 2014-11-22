var util = require('util'),
    Log = require('../../util/log'),
    MessageEncoder = require('../message_encoder'),
    Message = require('../message');
    
var logger = Log.getLogger('rpc.chatserver_messages.DisconnectMessage');

var DisconnectMessage = function(chatserver) {
    Message.call(this, chatserver);
    this.errorCode = NaN;
    this.errorMessage = null;    
};

DisconnectMessage.messageId = "disconnect";
DisconnectMessage.acceptFromClient = true;

util.inherits(DisconnectMessage, Message)

DisconnectMessage.prototype.receive = function(message, user) {
    this.text = message.data;
    this.user = user;
    this.user.leaveRoom();
    if (user.connection.connected) {
        logger.debug("Disconnect requested.  Connection is still open, so closing now.", user.logNotation);
        user.connection.close();
    }
};

DisconnectMessage.prototype.send = function(user) {
    var message = {
        msg: this.messageId,
        data: {}
    };
    if (!isNaN(this.errorCode)) {
        logger.debug("Sending user disconnect message with error. Code: " + this.errorCode +
                    " message: " + this.errorMessage, user.logNotation);
        message.data.error_code = this.errorCode;
        message.data.error_message = this.errorMessage;
    }
    user.connection.send(MessageEncoder.encode(message));
};

module.exports = DisconnectMessage;
