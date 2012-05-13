var util = require('util'),
    Log = require('../../util/log'),
    GUIDUtil = require('../../util/guid_util');
    
var logger = Log.getLogger('rpc.chatserver_binary_messages.SyncedListPushMessage');

var Msg = function(chatserver) {
    this.appGuid = null;
    this.stateHistoryList = null;
};

Msg.messageId = 0x4C444D50; // LDMP
Msg.acceptFromClient = false;
Msg.binary = true;

Msg.prototype.send = function(user) {
    if (!this.buffer) {
        // msgID + appGuid + stateCount(32bit) + n*msgSizeField(16bit) + totalSerializedMessageBytes
        var msgLength = 4 + 16 + 4 + (this.stateHistoryList.length * 2) + this.stateHistoryList.bytesUsed;

        var buffer = this.buffer = new Buffer(msgLength);
        
        var offset = 0;
        
        // Write messageId
        buffer.writeUInt32BE(Msg.messageId, offset);
        offset += 4;
        
        // Write app guid
        GUIDUtil.writeBytes(this.appGuid, buffer, offset);
        offset += 16;

        // Write number of state entries
        buffer.writeUInt32BE(this.stateHistoryList.length, offset);
        offset += 4;
        
        this.stateHistoryList.forEach(function(item) {
            buffer.writeUInt16BE(item.buffer.length, offset);
            offset += 2;
            
            item.buffer.copy(buffer, offset);
            offset += item.buffer.length;
        });
    }

    user.connection.send(this.buffer);
};

module.exports = Msg;
