var sys = require('sys'),
    events = require('events'),
    config = require('../config'),
    UserEnterMessage = require('../rpc/client/user_enter'),
    UserLeaveMessage = require('../rpc/client/user_leave'),
    RoomDefinitionUpdatedMessage = require('../rpc/client/room_definition_updated'),
    RoomEnteredMessage = require('../rpc/client/room_entered'),
    MessageEncoder = require('../rpc/message_encoder'),
    redisConnectionManager = require('./redis_connection_manager');

var Room = function(chatserver, guid) {
    events.EventEmitter.call(this);
    this.redis = redisConnectionManager.getClient('room_definitions');
    this.presenceDB = redisConnectionManager.getClient('presence');

    if (!chatserver) {
        throw new Error("You must provide a chatserver instance.")
    }
    this.guid = guid;
    this.name = "Uninitialized Room";
    this.chatserver = chatserver;
    this.users = [];
    this.usersByUserGuid = {};
    
    // Update redis database to reflect that this room is hosted here
    this.presenceDB.hset('serverForRoom', this.guid, chatserver.serverId);
    this.presenceDB.sadd('roomsOnServer:'+this.chatserver.serverId, this.guid);
    this.presenceDB.del('roomUsers:'+this.guid);
};
sys.inherits(Room, events.EventEmitter);

Room.prototype.userEnter = function(newUser) {
    var message = new UserEnterMessage(this.chatserver);
    message.user = newUser;

    message.user.position = [
        Math.floor(Math.random() * config.roomWidth),
        Math.floor(Math.random() * config.roomHeight)
    ];

    if (!this.usersByUserGuid[newUser.guid]) {
        // console.log("Adding user " + newUser.guid + " to room " + this.guid);
        this.users.push(newUser);
        this.usersByUserGuid[newUser.guid] = newUser;
        newUser.currentRoom = this;
        
        // Update the user list for the room in Redis
        this.presenceDB.sadd('roomUsers:'+this.guid, newUser.guid);

        // notify all users of the new entry
        this.sendMessage(message);
        
        message = new RoomEnteredMessage();
        message.roomGuid = this.guid;
        newUser.sendMessage(message);
    }
    else {
        // console.log("User already exists in room.  Not sending user_enter message.");
    }
};
Room.prototype.userLeave = function(userGuid) {
    var leavingUser = this.usersByUserGuid[userGuid];
    if (leavingUser) {
        // notify other users of the user leaving
        var message = new UserLeaveMessage(this.chatserver);
        message.user = leavingUser;

        this.sendMessage(message);
        this.users.splice(this.users.indexOf(leavingUser), 1);
        delete this.usersByUserGuid[leavingUser.guid];
        leavingUser.currentRoom = null;
        
        // Update the user list for the room in Redis
        this.presenceDB.srem('roomUsers:'+this.guid, leavingUser.guid);
        if (this.users.length === 0) {
            this.destroy();
        }
    }
    else {
        // The specified user isn't in the room
    }
};
Room.prototype.sendMessage = function(message, excludeUserGuid) {
    this.users.forEach(function(user) {
        if (user.guid !== excludeUserGuid) {
            user.sendMessage(message);
        }
    });
};
Room.prototype.reload = function() {
    this.loadData(this.guid, function() {
       // do nothing; 
    });
};
Room.prototype.loadData = function(guid, callback) {
    this.guid = guid;
    var self = this,
        fail = function(err) {
            if (callback && typeof(callback) === 'function') {
                callback(err);
            }
            self.emit("loadError", err);
        };
    this.redis.hget('roomDefinition', guid, function(err, data) {
        var definition;
        if (err) {
            fail(err);
            return;
        }
        if (data === null) {
            fail("Room " + guid + " does not exist.");
        }
        try {
            definition = JSON.parse(data.toString('utf8'));
        }
        catch (e) {
            fail(e);
            return;
        }
        self.name = definition.name;
        self.worldGuid = definition.world_guid;
        self.definition = definition;

        self.emit("ready");
    });
};
Room.prototype.handlePubSubMessage = function(channel, message) {
    try {
        message = MessageEncoder.decode(message);
        switch (message.msg) {
            case "room_definition_updated":
                this.reload();
                this.forwardMessageToUsers(message);
                break;
            default:
                this.forwardMessageToUsers(message);
                break;
        }
    }
    catch (e) {
        console.log("Error while distributing message to room from control channel: " + e);
    }
};
Room.prototype.forwardMessageToUsers = function(message) {
    this.users.forEach(function(user) {
       user.session.client.send(MessageEncoder.encode(message));
    });
}
Room.prototype.destroy = function() {
    this.presenceDB.hdel('serverForRoom', this.guid);
    this.presenceDB.srem('roomsOnServer:'+this.chatserver.serverId, this.guid);
    this.presenceDB.del('roomUsers:'+this.guid);
    this.emit('empty');
}


module.exports = Room;