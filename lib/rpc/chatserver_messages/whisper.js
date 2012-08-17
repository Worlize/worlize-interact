var util = require('util'),
    Log = require('../../util/log'),
    MessageEncoder = require('../message_encoder'),
    Message = require('../message');

var logger = Log.getLogger('rpc.chatserver_messages.Whisper');
    
var WhisperMessage = function(chatserver) {
    Message.call(this, chatserver);
    this.user = null;
    this.to_user = null;
    this.text = "";
};
util.inherits(WhisperMessage, Message);

WhisperMessage.messageId = "whisper";
WhisperMessage.acceptFromClient = true;

var commandRegExp = /^(\w*) ?(.*)$/i;

WhisperMessage.prototype.receive = function(message, user) {
    this.text = message.data.text;
    this.to_user = message.data.to_user;
    this.user = user;
    if (user.currentRoom) {
        var recipient = user.currentRoom.getUserByGuid(this.to_user);
        if (recipient) {
            if (this.text.charAt(0) === '`') {
                var cmdMatch = commandRegExp.exec(this.text.slice(1));
                if (cmdMatch) {
                    var cmdName = cmdMatch[1];
                    var cmdParams = cmdMatch[2];
                    user.currentRoom.handleChatCommand(cmdName, this.user, recipient, cmdParams);
                }
            }
            else {
                if (user.hasActiveRestriction('gag')) {
                    return;
                }
                recipient.sendMessage(this);
                user.sendMessage(this);
            }
        }
        else {
            logger.warn("Unable to locate the specified recipient: " + this.to_user, user.logNotation);
        }
    }
};

WhisperMessage.prototype.send = function(user) {
    user.connection.send(MessageEncoder.encode(this.getSerializableHash()));
};

WhisperMessage.prototype.getSerializableHash = function() {
    return {
        msg: WhisperMessage.messageId,
        data: {
            user: this.user.guid,
            text: this.text
        }
    };
};

module.exports = WhisperMessage;