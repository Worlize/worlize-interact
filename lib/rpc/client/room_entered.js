var sys = require('sys'),
    kiwi = require('kiwi'),
    Class = kiwi.require('class').Class,
    Message = require('../message');
    
var Msg = new Message.extend({
    constructor: function(chatserver) {
        Message.call(this, chatserver);
        this.roomGuid = null;
    },
    send: function(client) {
        client.send({
            msg: "room_entered",
            data: this.roomGuid
        });
    }
});

module.exports = Msg;