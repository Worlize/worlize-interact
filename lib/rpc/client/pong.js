var sys = require('sys'),
    kiwi = require('kiwi'),
    Class = kiwi.require('class').Class,
    MessageEncoder = require('../message_encoder'),
    Message = require('../message');
    
var message = new Message.extend({
    constructor: function(chatserver) {
        Message.call(this, chatserver);
    },
    receive: function(message, client) {
        // do nothing
    },
    send: function(client) {
        var message = this.serializedMessage();
        client.send(MessageEncoder.encode(message));
    },
    serializedMessage: function() {
        return {
            msg: "pong"
        };
    }
});

module.exports = message;