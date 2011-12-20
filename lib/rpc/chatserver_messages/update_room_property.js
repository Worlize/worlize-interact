var util = require('util'),
    Log = require('../../util/log'),
    MessageEncoder = require('../message_encoder'),
    Message = require('../message');
    
var logger = Log.getLogger('rpc.chatserver_messages.UpdateRoomPropertyMessage');
    
var UpdateRoomPropertyMessage = function(chatserver) {
    Message.call(this, chatserver);
    this.user = null;
    this.name = null;
    this.value = null;
};
util.inherits(UpdateRoomPropertyMessage, Message);

UpdateRoomPropertyMessage.messageId = "update_room_property";
UpdateRoomPropertyMessage.acceptFromClient = true;

UpdateRoomPropertyMessage.prototype.receive = function(message, user) {
    var self = this;
    this.user = user;
    this.name = message.data.name;
    this.value = message.data.value;
    if (user.currentRoom && user.currentRoom.definition) {
        if (user.currentRoom.definition.ownerGuid === user.guid) {
            user.currentRoom.definition.updateProperty(this.name, this.value, function(err) {
                if (err) {
                    logger.error("Unable to save room definition: " + err.toString());
                    return;
                }
                logger.info("action=change_room_property User changed room property. propertyName=" + self.name, self.user.logNotation);
                user.currentRoom.broadcast(self);
            })
        }
        else {
            var serializedValue = JSON.stringify(this.value);
            logger.warn("Unauthorized user attempted to change room property.  " +
                        "action=unauthorized_action " +
                        "propertyName=" + this.name + " " +
                        "propertyValue=" + serializedValue, user.logNotation);
        }
    }
};

UpdateRoomPropertyMessage.prototype.send = function(user) {
    user.connection.send(MessageEncoder.encode(this.getSerializableHash()));
};

UpdateRoomPropertyMessage.prototype.getSerializableHash = function() {
    return {
        msg: UpdateRoomPropertyMessage.messageId,
        data: {
            name: this.name,
            value: this.value
        }
    };
};

module.exports = UpdateRoomPropertyMessage;