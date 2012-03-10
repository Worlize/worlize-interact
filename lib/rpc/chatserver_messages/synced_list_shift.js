var util = require('util'),
    Log = require('../../util/log'),
    GUIDUtil = require('../../util/guid_util');
    
var logger = Log.getLogger('rpc.chatserver_binary_messages.SyncedListPushMessage');

var Msg = function(chatserver) {
    this.user = null;
    this.appGuid = null;
};

Msg.messageId = 0x4C534654; // LSFT
Msg.acceptFromClient = false;
Msg.binary = true;

Msg.prototype.send = function(user) {
    if (!this.buffer) {
        var buffer = new Buffer(this.user ? 37 : 21);
        this.buffer = buffer;

        // Write messageId
        buffer.writeUInt32BE(Msg.messageId, 0);

        // Write a 0x01 byte if we have a user guid, otherwise a 0x00 byte
        buffer.writeUInt8(this.user ? 1 : 0, 4);

        // Write app guid
        GUIDUtil.writeBytes(this.appGuid, buffer, 5);

        if (this.user) {
            // Write user guid
            GUIDUtil.writeBytes(this.user.guid, buffer, 21);
        }
    }

    user.connection.send(this.buffer);
};

module.exports = Msg;
