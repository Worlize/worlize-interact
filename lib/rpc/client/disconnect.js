var sys = require('sys'),
    Message = require('../message');

var DisconnectMessage = function(chatserver) {
    Message.call(this, chatserver);
    this.session = null;
    this.user = null;
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

module.exports = DisconnectMessage;