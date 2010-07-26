var sys = require('sys'),
    kiwi = require('kiwi'),
    Class = kiwi.require('class').Class,
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
            this.user.face = message.data;
            if (client.session.room) {
                client.session.room.sendMessage(this, this.user.guid);
            }
        }
    },
    send: function(client) {
        client.send({
            msg: "set_face",
            data: {
                user: this.user.guid,
                face: this.user.face
            }
        });
    },
});

module.exports = msg;