var sys = require('sys'),
    MessageEncoder = require('../message_encoder'),
    Message = require('../message');

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

DisconnectMessage.prototype.receive = function(message, client) {
    this.text = message.data;
    this.user = client.session.user;
    var room = client.session.room;
    if (room) {
        room.userLeave(this.user.guid);
    }
};

DisconnectMessage.prototype.send = function(client) {
    var message = {
        msg: this.messageId,
        data: {}
    };
    if (!isNaN(this.errorCode)) {
        message.data.error_code = this.errorCode;
        message.data.error_message = this.errorMessage;
    }
    client.send(MessageEncoder.encode(message));
};

module.exports = DisconnectMessage;