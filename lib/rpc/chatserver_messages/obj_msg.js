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
    this.toUserGuids = null;
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
    // console.log("Receive app broadcast message");

    this.flags = buffer.readUInt8(offset);
    var hasToUserGuids = Boolean(this.flags & 0x01);
    this.broadcastToAllApps = Boolean(this.flags & 0x02);
    offset += 1;
    // console.log("Flags: " + this.flags);
    // console.log("hasToUserGuids: " + hasToUserGuids);
    // console.log("this.broadcastToAllApps: " + this.broadcastToAllApps);
    
    this.fromAppInstanceGuid = GUIDUtil.readBytes(buffer, offset);
    // console.log("fromAppInstanceGuid: " + this.fromAppInstanceGuid);
    offset += 16;
    
    if (!this.broadcastToAllApps) {
        this.toAppInstanceGuid = GUIDUtil.readBytes(buffer, offset);
        // console.log("toAppInstanceGuid: " + this.toAppInstanceGuid);
        offset += 16;
    }
    
    if (hasToUserGuids) {
        this.toUserGuids = [];
        // Should read in optional destination user guid
        var recipientUserCount = buffer.readUInt16BE(offset);
        offset += 2;
        
        // console.log("recipientUserCount: " + recipientUserCount);
        
        for (var i=0; i < recipientUserCount; i ++) {
            this.toUserGuids.push(GUIDUtil.readBytes(buffer, offset));
            offset += 16;
        }
        // console.log("toUserGuids: ", this.toUserGuids);
    }
    
    this.message = buffer.slice(offset);
    // console.log("Message length: " + this.message.length);
    
    if (user.currentRoom) {
        this.room = user.currentRoom.guid;
        if (hasToUserGuids) {
            for (var i=0; i < recipientUserCount; i++) {
                var recipient = user.currentRoom.getUserByGuid(this.toUserGuids[i]);
                if (recipient) {
                    // console.log("Sending message to recipient " + recipient.guid);
                    recipient.sendMessage(this);
                }
            }
        }
        else {
            // console.log("Broadcasting message to room");
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