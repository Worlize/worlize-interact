var util = require('util'),
    Log = require('../../util/log'),
    GUIDUtil = require('../../util/guid_util'),
    MessageEncoder = require('../message_encoder'),
    Message = require('../message');
    
var logger = Log.getLogger('rpc.chatserver_messages.AppBroadcastMessage');
    
var Msg = function(chatserver) {
    Message.call(this, chatserver);
    this.room = null;
    this.fromAppInstanceGuid = null;
    this.toAppInstanceGuid = null;
    this.user = null;
    this.toUserGuid = null;
    this.message = null;
    this.flags = 0x00;
};
util.inherits(Msg, Message);

Msg.messageId = 0x42435354; // BCST
Msg.acceptFromClient = true;
Msg.binary = Msg.prototype.binary = true;

Msg.prototype.receive = function(buffer, user) {
    this._buffer = null;
    this.user = user;
    
    var offset = 4;
    
    var len = buffer.length;
    if (len < 1) {
        throw new Error("Insufficient data to read flags.");
    }
    console.log("Receive app broadcast message");

    this.flags = buffer.readUInt8(offset);
    var hasToUserGuid = Boolean(this.flags & 0x01);
    this.broadcastToAllApps = Boolean(this.flags & 0x02);
    offset += 1;
    console.log("Flags: " + this.flags);
    console.log("hasToUserGuid: " + hasToUserGuid);
    console.log("this.broadcastToAllApps: " + this.broadcastToAllApps);
    
    if (len - offset < 16) {
        throw new Error("Insufficient data to read source app instance guid");
    }
    this.fromAppInstanceGuid = GUIDUtil.readBytes(buffer, offset);
    console.log("fromAppInstanceGuid: " + this.fromAppInstanceGuid);
    offset += 16;
    
    if (!this.broadcastToAllApps) {
        if (len - offset < 16) {
            throw new Error("Insufficient data to read recipient app instance guid");
        }
        this.toAppInstanceGuid = GUIDUtil.readBytes(buffer, offset);
        console.log("toAppInstanceGuid: " + this.toAppInstanceGuid);
        offset += 16;
    }
    
    if (hasToUserGuid) {
        if (len - offset < 16) {
            throw new Error("Insufficent data to read user guid.");
        }
        // Should read in optional destination user guid
        this.toUserGuid = GUIDUtil.readBytes(buffer, offset);
        console.log("toUserGuid: " + this.toUserGuid);
        offset += 16;
    }
    
    this.message = buffer.slice(offset);
    console.log("Message length: " + this.message.length);
    
    if (user.currentRoom) {
        this.room = user.currentRoom.guid;
        if (this.toUserGuid) {
            var recipient = user.currentRoom.getUserByGuid(this.toUserGuid);
            if (recipient) {
                recipient.sendMessage(this);
            }
            else {
                logger.warn("Tried to send app broadcast message to user guid " + this.toUserGuid + " not in the room.")
            }
        }
        else {
            user.currentRoom.broadcast(this);
        }
    }
    
};

Msg.prototype.send = function(user) {
    if (!this._buffer) {
        if (!this.message) {
            logger.error("Trying to send AppBroadcastMessage with no message!");
            return;
        }

        var baseLength = 4 + 1 + 16 + 16 + 16;
        var flags = 0x00;
        if (this.broadcastToAllApps) {
            flags |= 0x02;
            baseLength -= 16;
        }

        var buffer = new Buffer(baseLength + this.message.length);
        this._buffer = buffer;

        var offset = 0;

        // Write messageId
        buffer.writeUInt32BE(Msg.messageId, offset);
        offset += 4;

        // Write Flags
        buffer.writeUInt8(flags, offset);
        offset += 1;

        // Write user guid
        GUIDUtil.writeBytes(this.user.guid, buffer, offset);
        offset += 16;

        // Write app guid
        GUIDUtil.writeBytes(this.fromAppInstanceGuid, buffer, offset);
        offset += 16;

        if (!this.broadcastToAllApps) {
            // Write recipient app guid
            GUIDUtil.writeBytes(this.toAppInstanceGuid, buffer, offset);
            offset += 16;
        }
        
        // Write the serialized AMF3 object data
        this.message.copy(buffer, offset, 0, this.message.length);
    }

    user.connection.send(this._buffer);
};

module.exports = Msg;