var sys = require('sys'),
    kiwi = require('kiwi'),
    Class = kiwi.require('class').Class,
    Message = require('./message').Message;
    
var SayMessage = new Message.extend({
    constructor: function(chatserver) {
        Message.call(this, chatserver);
        this.session = null;
    },
    read: function(message, client) {
        sys.log("Client " + client.sessionId + " says '" + message.data + "'");
    }
});

exports.SayMessage = SayMessage;