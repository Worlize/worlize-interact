var sys = require('sys'),
    kiwi = require('kiwi'),
    Class = kiwi.require('class').Class,
    MessageEncoder = require('../message_encoder'),
    Message = require('../message');
    
var Msg = new Message.extend({
    constructor: function(chatserver) {
        Message.call(this, chatserver);
        this.session = null;
        this.user = null;
    },
    receive: function(message, client) {
        this.text = message.data;
        this.user = client.session.user;
        if (client.session.room) {
            client.session.room.sendMessage(this);
        }
    },
    send: function(client) {
        var message = this.serializedMessage();
        client.send(MessageEncoder.encode(message));
    },
    serializedMessage: function() {
        return {
            msg: "room_msg",
            data: {
                user: this.user.guid,
                text: this.text
            }
        };
    }
});

module.exports = Msg;