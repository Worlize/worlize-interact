var util = require('util'),
    Message = require('../message');
    
var InstantiateRoomMessage = function(chatserver) {
    Message.call(this, chatserver);
};
util.inherits(InstantiateRoomMessage, Message);

InstantiateRoomMessage.messageId = "instantiate_room";

InstantiateRoomMessage.prototype.receive = function(message, client) {
    console.log("We've been requested to instantiate room " + message.data.room_guid);
};

module.exports = InstantiateRoomMessage;