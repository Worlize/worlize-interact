var util = require('util'),
    MessageEncoder = require('../message_encoder'),
    Message = require('../message');
    
var Msg = function(chatserver) {
    Message.call(this, chatserver);
    this.user = null;
    this.presenceStatus = null;
};

util.inherits(Msg, Message);

Msg.messageId = "presence_status_change";
Msg.acceptFromClient = false;

Msg.prototype.send = function(client) {
    var message = this.getSerializableHash();
    client.send(MessageEncoder.encode(message));
};

Msg.prototype.getSerializableHash = function() {
    return {
        msg: Msg.messageId,
        data: {
            user: this.user.guid,
            presence_status: this.presenceStatus
        }
    };
};

module.exports = Msg;