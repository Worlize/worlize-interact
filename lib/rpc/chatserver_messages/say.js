var util = require('util'),
    Log = require('../../util/log'),
    MessageEncoder = require('../message_encoder'),
    Message = require('../message');
    
var logger = Log.getLogger('rpc.chatserver_messages.SayMessage');
    
var SayMessage = function(chatserver) {
    Message.call(this, chatserver);
    this.user = null;
};
util.inherits(SayMessage, Message);

SayMessage.messageId = "say";
SayMessage.acceptFromClient = true;

var commandRegExp = /^(\w*) ?(.*)$/i;

SayMessage.prototype.receive = function(message, user) {
    this.text = message.data;
    this.user = user;

    if (this.text.charAt(0) === '`') {
        var cmdMatch = commandRegExp.exec(this.text.slice(1));
        if (cmdMatch) {
            var cmdName = cmdMatch[1];
            var cmdParams = cmdMatch[2];
            user.currentRoom.handleChatCommand(cmdName, this.user, null, cmdParams);
        }
    }
    else if (user.currentRoom) {
        if (user.hasActiveRestriction('gag')) {
            return;
        }
        user.currentRoom.broadcast(this);
    }
};

SayMessage.prototype.send = function(user) {
    user.connection.send(MessageEncoder.encode(this.getSerializableHash()));
};

SayMessage.prototype.getSerializableHash = function() {
    return {
        msg: SayMessage.messageId,
        data: {
            user: this.user.guid,
            text: this.text
        }
    };
};

module.exports = SayMessage;