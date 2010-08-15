var sys = require('sys'),
    kiwi = require('kiwi'),
    Class = kiwi.require('class').Class,
    MessageEncoder = require('../message_encoder'),
    Message = require('../message');
    
var Msg = new Message.extend({
    constructor: function(chatserver) {
        Message.call(this, chatserver);
        this.roomGuid = null;
    },
    send: function(client) {
        client.send(MessageEncoder.encode({
            msg: "room_entered",
            data: this.roomGuid
        }));
    }
});

module.exports = Msg;