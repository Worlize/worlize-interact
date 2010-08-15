var sys = require('sys'),
    kiwi = require('kiwi'),
    Class = kiwi.require('class').Class,
    MessageEncoder = require('../message_encoder'),
    Message = require('../message');
    
var UserEnterMessage = new Message.extend({
    /*
        Attributes:
        user - "User" instance
    */
    
    constructor: function(chatserver) {
        Message.call(this, chatserver);
        this.user = null;
    },
    send: function(client) {
        var message = this.serializedMessage();
        client.send(MessageEncoder.encode(message));
    },
    serializedMessage: function() {
        return {
            msg: "user_enter",
            data: {
                userName: this.user.userName,
                guid: this.user.guid,
                position: this.user.position,
                face: this.user.face
            }
        };
    }
});

module.exports = UserEnterMessage;