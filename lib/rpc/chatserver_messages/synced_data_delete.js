var util = require('util'),
    Log = require('../../util/log'),
    GUIDUtil = require('../../util/guid_util');
    
var logger = Log.getLogger('rpc.chatserver_binary_messages.SyncedDataSetMessage');

var Msg = function(chatserver) {
    this.user = null;
    this.key = null;
    this.value = null;
};

Msg.messageId = 0x4444454c; // DDEL
Msg.acceptFromClient = true;
Msg.binary = true;

Msg.prototype.receive = function(buffer, user) {
    var offset = 4;
    this.buffer = null;
    
    this.user = user;
    this.appGuid = GUIDUtil.readBytes(buffer, offset);
    offset += 16;
    
    var keyNameByteLength = buffer.readUInt16BE(offset);
    offset += 2;
    
    this.key = buffer.toString('utf8', offset, offset + keyNameByteLength);
    offset += keyNameByteLength;
    
    if (user.currentRoom) {
        var data = user.currentRoom.appSyncedDataStores[this.appGuid];
        if (!data) {
            logger.warn("Client tried to delete synced data value for nonexistent app " + this.appGuid);
            return;
        }
        
        delete data[this.key];
        user.currentRoom.broadcast(this);
    }
};

Msg.prototype.send = function(user) {
    if (!this.buffer) {
        var offset = 0;
        
        var keyNameByteLength = Buffer.byteLength(this.key, 'utf8');
        
        var length = 4 + 16 + 2 + keyNameByteLength;
        var buffer = new Buffer(length);
        this.buffer = buffer;

        // Write messageId
        buffer.writeUInt32BE(Msg.messageId, offset);
        offset += 4;
        
        // Write app guid
        GUIDUtil.writeBytes(this.appGuid, buffer, offset);
        offset += 16;
        
        // Write byteLength of key name
        buffer.writeUInt16BE(keyNameByteLength, offset);
        offset += 2;
        
        // Write key name
        var bytesWritten = buffer.write(this.key, offset, 'utf8');
        offset += bytesWritten;
    }

    user.connection.send(this.buffer);
};

module.exports = Msg;
