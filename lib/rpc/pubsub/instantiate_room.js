var sys = require('sys'),
    kiwi = require('kiwi'),
    Class = kiwi.require('class').Class,
    Message = require('../message');
    
var InstantiateRoomMessage = new Message.extend({
    constructor: function(chatserver) {
        Message.call(this, chatserver);
    },
    receive: function(message, client) {
        sys.log("We've been requested to instantiate room " + message.data.room_guid);
    }
});

module.exports = InstantiateRoomMessage;