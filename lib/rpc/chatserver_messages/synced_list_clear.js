var util = require('util'),
    Log = require('../../util/log'),
    GUIDUtil = require('../../util/guid_util');
    
var logger = Log.getLogger('rpc.chatserver_binary_messages.SyncedListPushMessage');

var Msg = function(chatserver) {
    this.user = null;
    this.appGuid = null;
};

Msg.messageId = 0x4C434C52; // LCLR
Msg.acceptFromClient = true;
Msg.binary = true;

Msg.prototype.receive = function(buffer, user) {
    this.buffer = null;
    this.user = user;
    this.appGuid = GUIDUtil.readBytes(buffer, 0);
};

Msg.prototype.send = function(user) {
    if (!this.buffer) {
        var offset = 0;
        
        var buffer = new Buffer(36);
        this.buffer = buffer;
        
        // Write messageId
        buffer.writeUInt32BE(Msg.messageId, offset);
        offset += 4;
        
        // Write a 0x01 byte if we have a user guid, otherwise a 0x00 byte
        buffer.writeUInt8(this.user ? 1 : 0, offset);
        offset ++;
        
        // Write app guid
        GUIDUtil.writeBytes(this.appGuid, buffer, offset);
        offset += 16;
        
        if (this.user) {
            // Write user guid
            GUIDUtil.writeBytes(this.user.guid, buffer, offset);
        }
    }
    user.connection.send(this.buffer);
};

module.exports = Msg;
