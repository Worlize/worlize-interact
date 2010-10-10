var sys = require('sys'),
    Message = require('../message');
    
var InstantiateRoomMessage = function(chatserver) {
    Message.call(this, chatserver);
};
sys.inherits(InstantiateRoomMessage, Message);

InstantiateRoomMessage.prototype.receive = function(message, client) {
    sys.log("We've been requested to instantiate room " + message.data.room_guid);
};

module.exports = InstantiateRoomMessage;