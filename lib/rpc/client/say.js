var sys = require('sys'),
    kiwi = require('kiwi'),
    Class = kiwi.require('class').Class,
    Message = require('../message');
    
var SayMessage = new Message.extend({
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
//        sys.log("[" + client.session.guid + "] Say: '" + message.data + "'");
    },
    send: function(client) {
        var message = this.serializedMessage();
        client.send(message);
    },
    serializedMessage: function() {
        return {
            msg: "say",
            data: {
                user: this.user.guid,
                text: this.text
            }
        };
    }
});

module.exports = SayMessage;