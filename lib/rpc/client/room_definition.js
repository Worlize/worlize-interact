var sys = require('sys'),
    kiwi = require('kiwi'),
    Class = kiwi.require('class').Class,
    MessageEncoder = require('../message_encoder'),
    Message = require('../message');
    
var RoomDefinitionMessage = new Message.extend({
    constructor: function(chatserver) {
        Message.call(this, chatserver);
        this.room = null;
    },
    send: function(client) {
        var message = this.serializedMessage();
        client.send(MessageEncoder.encode(message));
    },
    serializedMessage: function() {
        return {
            msg: "room_definition",
            data: this.room
        };
    }
});

module.exports = RoomDefinitionMessage;