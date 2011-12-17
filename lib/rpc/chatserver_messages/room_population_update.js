var util = require('util'),
    Log = require('../../util/log'),
    MessageEncoder = require('../message_encoder'),
    Message = require('../message');

var logger = Log.getLogger('rpc.chatserver_messages.RoomPopulationUpdate');
    
var RoomPopulationUpdate = function(chatserver) {
    Message.call(this, chatserver);
    this.room = null;
    this.userAdded = null;
    this.userRemoved = null;
};
util.inherits(RoomPopulationUpdate, Message);

RoomPopulationUpdate.messageId = "room_population_update";
RoomPopulationUpdate.acceptFromClient = false;

RoomPopulationUpdate.prototype.getSerializableHash = function() {
    var data = {
        guid: this.room.guid,
        name: this.room.definition.name,
        userCount: this.room.users.length
    };
    if (this.userAdded) {
        data.userAdded = {
            guid: this.userAdded.guid,
            userName: this.userAdded.userName
        };
    }
    if (this.userRemoved) {
        data.userRemoved = {
            guid: this.userRemoved.guid,
            userName: this.userRemoved.userName
        };
    }
    
    var obj = {
        msg: RoomPopulationUpdate.messageId,
        data: data
    };
    
    return obj;
};

module.exports = RoomPopulationUpdate;