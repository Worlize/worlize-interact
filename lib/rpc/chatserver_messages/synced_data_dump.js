var util = require('util'),
    Log = require('../../util/log'),
    GUIDUtil = require('../../util/guid_util');
    
var logger = Log.getLogger('rpc.chatserver_binary_messages.SyncedListPushMessage');

var Msg = function(chatserver) {
    this.appGuid = null;
    this.syncedDataStore = null;
};

Msg.messageId = 0x44444d50; // DDMP
Msg.acceptFromClient = false;
Msg.binary = true;

Msg.prototype.send = function(user) {
    if (!this.buffer) {
        
        var keys = Object.keys(this.syncedDataStore);
        var keyCount = keys.length;
        var totalKeyByteLength = 0;
        var totalValueByteLength = 0;
        for (var i=0; i < keyCount; i++) {
            var key = keys[i];
            totalKeyByteLength += Buffer.byteLength(key, 'utf8');
            totalValueByteLength += this.syncedDataStore[keys[i]].length;
        }
        
        // msgID + appGuid + keyCount(32bit) + ((keyLenField+valueLenField) * keyCount) + totalKeyByteLength + totalValueByteLength
        var msgLength = 4 + 16 + 4 + ((2+4) * keyCount) + totalKeyByteLength + totalValueByteLength;

        var buffer = this.buffer = new Buffer(msgLength);
        
        var offset = 0;
        
        // Write messageId
        buffer.writeUInt32BE(Msg.messageId, offset);
        offset += 4;
        
        // Write app guid
        GUIDUtil.writeBytes(this.appGuid, buffer, offset);
        offset += 16;

        // Write number of keys
        buffer.writeUInt32BE(keyCount, offset);
        offset += 4;
        
        var syncedDataStore = this.syncedDataStore;
        keys.forEach(function(key) {
            var value = syncedDataStore[key];
            
            // Write key name...
            var keyNameByteLength = buffer.write(key, offset + 2, 'utf8');
            buffer.writeUInt16BE(keyNameByteLength, offset);
            offset += keyNameByteLength + 2;
            
            // Write value length
            buffer.writeUInt32BE(value.length, offset);
            offset += 4;
            
            // Write value data
            value.copy(buffer, offset);
            offset += value.length;
        });
    }

    user.connection.send(this.buffer);
};

module.exports = Msg;
