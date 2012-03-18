var util = require('util'),
    Log = require('../../util/log'),
    GUIDUtil = require('../../util/guid_util');
    
var logger = Log.getLogger('rpc.chatserver_binary_messages.SyncedListPushMessage');

var Msg = function(chatserver) {
    this.user = null;
};

Msg.messageId = 0x4C505348; // LPSH
Msg.acceptFromClient = true;
Msg.binary = true;

Msg.prototype.receive = function(buffer, user) {
    var offset = 4;
    this.buffer = null;
    
    this.user = user;
    this.appGuid = GUIDUtil.readBytes(buffer, offset);
    offset += 16;
    this.data = buffer.slice(offset);
    
    if (user.currentRoom) {
        var list = user.currentRoom.definition.appStateHistoryLists[this.appGuid];
        if (!list) {
            logger.warn("Client tried to add history state for nonexistent app " + this.appGuid);
            return;
        }
        
        list.push(this.user.guid, this.data);
        user.currentRoom.broadcast(this);
    }
};

Msg.prototype.send = function(user) {
    if (!this.buffer) {
        var offset = 0;
        
        if (!this.data) {
            logger.error("Trying to send SyncedListPushMessage with no data!");
            return;
        }
        var buffer = new Buffer(36 + this.data.length);
        this.buffer = buffer;

        // Write messageId
        buffer.writeUInt32BE(Msg.messageId, offset);
        offset += 4;

        // Write app guid
        GUIDUtil.writeBytes(this.appGuid, buffer, offset);
        offset += 16;

        // Write user guid
        GUIDUtil.writeBytes(this.user.guid, buffer, offset);
        offset += 16;

        // Write the serialized AMF3 object data
        this.data.copy(buffer, offset);
    }

    user.connection.send(this.buffer);
};

module.exports = Msg;
