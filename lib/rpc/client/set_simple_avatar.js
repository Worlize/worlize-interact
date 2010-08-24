var sys = require('sys'),
    kiwi = require('kiwi'),
    Class = kiwi.require('class').Class,
    MessageEncoder = require('../message_encoder'),
    Message = require('../message');
    
var msg = new Message.extend({
    constructor: function(chatserver) {
        Message.call(this, chatserver);
        this.session = null;
        this.user = null;
    },
    receive: function(message, client) {
        this.user = client.session.user;
        if (message.data) {
            this.user.avatar = {
                type: "simple",
                guid: message.data
            };
            if (client.session.room) {
                client.session.room.sendMessage(this, this.user.guid);
            }
        }
    },
    send: function(client) {
        client.send(MessageEncoder.encode({
            msg: "set_simple_avatar",
            data: {
                user: this.user.guid,
                avatar: this.user.avatar
            }
        }));
    },
});

module.exports = msg;