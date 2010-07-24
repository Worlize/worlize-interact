var sys = require('sys'),
    kiwi = require('kiwi'),
    Class = kiwi.require('class').Class,
    Message = require('../message');
    
var MoveMessage = new Message.extend({
    constructor: function(chatserver) {
        Message.call(this, chatserver);
        this.session = null;
        this.user = null;
    },
    receive: function(message, client) {
        this.user = client.session.user;
        if (message.data) {
            this.user.position = [ message.data[0], message.data[1] ];
            if (client.session.room) {
                client.session.room.sendMessage(this, this.user.guid);
            }
        }
    },
    send: function(client) {
        var message = this.serializedMessage();
        client.send(message);
    },
    serializedMessage: function() {
        return {
            msg: "move",
            data: {
                user: this.user.guid,
                position: this.user.position
            }
        };
    }
});

module.exports = MoveMessage;