var util = require('util'),
    Log = require('../../util/log'),
    GUIDUtil = require('../../util/guid_util');
    
var logger = Log.getLogger('rpc.chatserver_binary_messages.SyncedListPushMessage');

var Msg = function(chatserver) {
    this.user = null;
    this.appGuid = null;
};

Msg.messageId = 0x4C534654; // LSFT
Msg.acceptFromClient = true;
Msg.binary = true;

Msg.prototype.receive = function(buffer, user) {
    this.buffer = null;
    this.user = user;
    this.appGuid = GUIDUtil.readBytes(buffer, 4);
    
    if (user.currentRoom) {
        var list = user.currentRoom.appStateHistoryLists[this.appGuid];
        if (!list) {
            logger.warn("Client tried to shift history state for nonexistent app " + this.appGuid);
            return;
        }
        
        list.shift();
        user.currentRoom.broadcast(this);
    }
};

Msg.prototype.send = function(user) {
    if (!this.buffer) {
        var buffer = this.buffer = new Buffer(20);

        // Write messageId
        buffer.writeUInt32BE(Msg.messageId, 0);

        // Write app guid
        GUIDUtil.writeBytes(this.appGuid, buffer, 4);
    }
    user.connection.send(this.buffer);
};

module.exports = Msg;
