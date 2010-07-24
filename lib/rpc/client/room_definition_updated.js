var sys = require('sys'),
    kiwi = require('kiwi'),
    Class = kiwi.require('class').Class,
    Message = require('../message');
    
var Msg = new Message.extend({
    constructor: function(chatserver) {
        Message.call(this, chatserver);
    },
    send: function(client) {
        client.send({
            msg: "room_definition_updated"
        });
    }
});

module.exports = Msg;