var util = require('util'),
    Log = require('../../util/log'),
    MessageEncoder = require('../message_encoder'),
    Message = require('../message');
    
var logger = Log.getLogger('rpc.chatserver_messages.UnlockRoomMessage');
    
var Msg = function(chatserver) {
    Message.call(this, chatserver);
    this.user = null;
    this.room = null;
};
util.inherits(Msg, Message);

Msg.messageId = "unlock_room";
Msg.acceptFromClient = true;

Msg.prototype.receive = function(message, user) {
    this._encodedMessage = null;
    var self = this;
    this.user = user;
    if (user.currentRoom) {
        user.currentRoom.unlock(user);
    }
};

Msg.prototype.send = function(user) {
    if (!this._encodedMessage) {
        this._encodedMessage = MessageEncoder.encode(this.getSerializableHash());
    }
    user.connection.send(this._encodedMessage);
};

Msg.prototype.getSerializableHash = function() {
    return {
        msg: Msg.messageId,
        data: {
            room: this.room.guid,
            user: this.user.guid
        }
    };
};

module.exports = Msg;