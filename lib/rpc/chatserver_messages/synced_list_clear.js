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
    this.data = buffer.slice(16);
};

Msg.prototype.send = function(user) {
    if (!this.buffer) {
        var buffer = new Buffer(36);
        this.buffer = buffer;
        
        // Write messageId
        buffer.writeUInt32BE(Msg.messageId, 0);

        // Write app guid
        GUIDUtil.writeBytes(this.appGuid, buffer, 4);

        // Write user guid
        GUIDUtil.writeBytes(this.user.guid, buffer, 20);
    }
    user.connection.send(this.buffer);
};

module.exports = Msg;
