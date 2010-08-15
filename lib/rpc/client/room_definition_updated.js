var sys = require('sys'),
    kiwi = require('kiwi'),
    Class = kiwi.require('class').Class,
    MessageEncoder = require('../message_encoder'),
    Message = require('../message');
    
var Msg = new Message.extend({
    constructor: function(chatserver) {
        Message.call(this, chatserver);
    },
    send: function(client) {
        client.send(MessageEncoder.encode({
            msg: "room_definition_updated"
        }));
    }
});

module.exports = Msg;