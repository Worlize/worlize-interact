var sys = require('sys'),
    kiwi = require('kiwi'),
    Class = kiwi.require('class').Class,
    MessageEncoder = require('../message_encoder'),
    Message = require('../message');
    
var UserLeaveMessage = new Message.extend({
    /*
        Attributes:
        user - "User" instance
    */
    
    constructor: function(chatserver) {
        Message.call(this, chatserver);
        this.user = null;
    },
    send: function(client) {
        client.send(MessageEncoder.encode({
            msg: "user_leave",
            data: this.user.guid
        }));
    }
});

module.exports = UserLeaveMessage;