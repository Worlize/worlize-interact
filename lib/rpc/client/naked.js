var sys = require('sys'),
    kiwi = require('kiwi'),
    Class = kiwi.require('class').Class,
    MessageEncoder = require('../message_encoder'),
    Message = require('../message');
    
var msg = new Message.extend({
    constructor: function(chatserver) {
        Message.call(this, chatserver);
        this.user = null;
    },
    receive: function(message, client) {
        this.user = client.session.user;
        this.user.avatar = null;
        if (client.session.room) {
            client.session.room.sendMessage(this, this.user.guid);
        }
    },
    send: function(client) {
        client.send(MessageEncoder.encode({
            msg: "naked",
            data: {
                user: this.user.guid
            }
        }));
    },
});

module.exports = msg;