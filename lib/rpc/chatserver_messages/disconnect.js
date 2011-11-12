var sys = require('sys'),
    Log = requrie('../../util/log'),
    MessageEncoder = require('../message_encoder'),
    Message = require('../message');
    
var logger = Log.getLogger('rpc.chatserver_messages.DisconnectMessage');

var DisconnectMessage = function(chatserver) {
    Message.call(this, chatserver);
    this.session = null;
    this.user = null;
    this.errorCode = NaN;
    this.errorMessage = null;
};

DisconnectMessage.messageId = "disconnect";
DisconnectMessage.acceptFromClient = true;

sys.inherits(DisconnectMessage, Message)

DisconnectMessage.prototype.receive = function(message, user) {
    this.text = message.data;
    this.user = user;
    this.user.leaveRoom();
};

DisconnectMessage.prototype.send = function(connection) {
    var message = {
        msg: this.messageId,
        data: {}
    };
    if (!isNaN(this.errorCode)) {
        logger.warn("Sending user disconnect message with error. Code: " + this.errorCode +
                    " message: " + this.errorMessage);
        message.data.error_code = this.errorCode;
        message.data.error_message = this.errorMessage;
    }
    connection.send(MessageEncoder.encode(message));
};

module.exports = DisconnectMessage;