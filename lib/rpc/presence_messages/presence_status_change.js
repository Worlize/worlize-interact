var sys = require('sys'),
    MessageEncoder = require('../message_encoder'),
    Message = require('../message');
    
var Msg = function(chatserver) {
    Message.call(this, chatserver);
    this.user = null;
    this.presenceStatus = null;
};

sys.inherits(Msg, Message);

Msg.messageId = "presence_status_change";
Msg.acceptFromClient = false;

Msg.prototype.send = function(client) {
    var message = this.serializedMessage();
    client.send(MessageEncoder.encode(message));
};

Msg.prototype.serializedMessage = function() {
    return {
        msg: Msg.messageId,
        data: {
            user: this.user.guid,
            presence_status: this.presenceStatus
        }
    };
};

module.exports = Msg;