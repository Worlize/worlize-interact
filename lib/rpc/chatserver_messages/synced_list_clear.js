var util = require('util'),
    Log = require('../../util/log'),
    GUIDUtil = require('../../util/guid_util');
    
var logger = Log.getLogger('rpc.chatserver_binary_messages.SyncedListPushMessage');

var Msg = function(chatserver) {
    this.user = null;
    this.appGuid = null;
    this.data = null;
};

Msg.messageId = 0x4C434C52; // LCLR
Msg.acceptFromClient = true;
Msg.binary = true;

Msg.prototype.receive = function(buffer, user) {
    var offset = 4;
    
    this.buffer = null;
    this.user = user;
    
    var flags = buffer.readUInt8(offset);
    offset ++;

    this.appGuid = GUIDUtil.readBytes(buffer, offset);
    offset += 16;
    
    if (user.currentRoom) {
        var list = user.currentRoom.appStateHistoryLists[this.appGuid];
        if (!list) {
            logger.warn("Client tried to clear history state for nonexistent app " + this.appGuid);
            return;
        }
        
        list.clear();
        if (flags & 0x01) {
            this.data = buffer.slice(offset);
            list.push(this.data);
        }
        user.currentRoom.broadcast(this);
    }
};

Msg.prototype.send = function(user) {
    if (!this.buffer) {
        var offset = 0;
        var msgLen = 4 + 1 + 16 + (this.data ? this.data.length : 0);
        
        var buffer = this.buffer = new Buffer(msgLen);
        
        // Write messageId
        buffer.writeUInt32BE(Msg.messageId, offset);
        offset += 4;
        
        buffer.writeUInt8(this.data ? 0x01 : 0x00, offset);
        offset ++;
        
        // Write app guid
        GUIDUtil.writeBytes(this.appGuid, buffer, offset);
        offset += 16;
        
        if (this.data) {
            this.data.copy(buffer, offset);
        }
    }
    user.connection.send(this.buffer);
};

module.exports = Msg;
