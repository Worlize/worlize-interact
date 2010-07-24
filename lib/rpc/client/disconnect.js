var sys = require('sys'),
    kiwi = require('kiwi'),
    Class = kiwi.require('class').Class,
    Message = require('../message');
    
var DisconnectMessage = new Message.extend({
    constructor: function(chatserver) {
        Message.call(this, chatserver);
        this.session = null;
        this.user = null;
    },
    receive: function(message, client) {
        this.text = message.data;
        this.user = client.session.user;
        var room = client.session.room;
        if (room) {
            room.userLeave(this.user.guid);
        }
    }
});

module.exports = DisconnectMessage;