var sys = require('sys'),
    events = require('events'),
    config = require('../config'),
    UserEnterMessage = require('../rpc/chatserver_messages/user_enter'),
    UserLeaveMessage = require('../rpc/chatserver_messages/user_leave'),
    RoomDefinitionUpdatedMessage = require('../rpc/chatserver_messages/room_definition_updated'),
    RoomEnteredMessage = require('../rpc/chatserver_messages/room_entered'),
    MessageEncoder = require('../rpc/message_encoder'),
    redisConnectionManager = require('./redis_connection_manager'),
    pubsubManager = require('./pubsub_manager'),
	streamingServerBalancer = require('./streaming_server_balancer');

var Room = function(chatserver, guid) {
    events.EventEmitter.call(this);
    var self = this;
    this.redis = redisConnectionManager.getClient('room_definitions');
    this.roomServerAssignmentsDB = redisConnectionManager.getClient('room_server_assignments');

    if (!chatserver) {
        throw new Error("You must provide a chatserver instance.")
    }
    this.guid = guid;
    this.name = "Uninitialized Room";
    this.chatserver = chatserver;
    this.users = [];
    this.usersByUserGuid = {};
	this.streamingServer = "rtmp://" + streamingServerBalancer.getServer() + "/videochat";
    
    // Update redis database to reflect that this room is hosted here
    this.roomServerAssignmentsDB.hset('serverForRoom', this.guid, chatserver.serverId);
    this.roomServerAssignmentsDB.sadd('roomsOnServer:'+this.chatserver.serverId, this.guid); 
    this.roomServerAssignmentsDB.del('roomUsers:'+this.guid);
    this.roomServerAssignmentsDB.zadd('activeRooms', 0, this.guid);
    
    this.pubSubMessageHandler = this.handlePubSubMessage.bind(this);
    pubsubManager.subscribe("room:"+this.guid, this.pubSubMessageHandler);
    
    console.log("Instantiated room " + this.guid + " - loading definition.");
    this.on('ready', function() {
        console.log("Room " + self.guid + " ready. Name: " + self.name);
    });
};
sys.inherits(Room, events.EventEmitter);

Room.prototype.userEnter = function(newUser) {
    var message = new UserEnterMessage(this.chatserver);
    message.user = newUser;

    message.user.position = [
        60 + Math.floor(Math.random() * (config.roomWidth - 120)),
        60 + Math.floor(Math.random() * (config.roomHeight - 120))
    ];

    if (!this.usersByUserGuid[newUser.guid]) {
        // console.log("Adding user " + newUser.guid + " to room " + this.guid);
        this.users.push(newUser);
        this.usersByUserGuid[newUser.guid] = newUser;
        newUser.currentRoom = this;
        
        // Update the user list for the room in Redis
        this.roomServerAssignmentsDB.sadd('roomUsers:'+this.guid, newUser.guid);
        
        // Update the score in the sorted set of active rooms
        this.roomServerAssignmentsDB.zadd('activeRooms', this.users.length, this.guid);

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
        this.roomServerAssignmentsDB.srem('roomUsers:'+this.guid, leavingUser.guid);
        
        // Update the score in the sorted set of active rooms
        this.roomServerAssignmentsDB.zadd('activeRooms', this.users.length, this.guid);
        
        if (this.users.length === 0) {
            this.destroy();
        }
    }
    else {
        // The specified user isn't in the room
    }
};
Room.prototype.getUserByGuid = function(guid) {
    return this.usersByUserGuid[guid];
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
    var self = this;
    function fail(err) {
        if (typeof(callback) === 'function') {
            callback(err);
        }
    }
    
    self.redis.hget('roomDefinition', guid, function(err, data) {
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

        if (typeof(callback) === 'function') {
            callback(null, definition);
        }
        self.emit("ready");
    });
};
Room.prototype.handlePubSubMessage = function(message) {
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
    var encodedMessage = MessageEncoder.encode(message);
    this.users.forEach(function(user) {
       user.session.client.send(encodedMessage);
    });
};
Room.prototype.destroy = function() {
    this.roomServerAssignmentsDB.hdel('serverForRoom', this.guid);
    this.roomServerAssignmentsDB.srem('roomsOnServer:'+this.chatserver.serverId, this.guid);
    this.roomServerAssignmentsDB.del('roomUsers:'+this.guid);
    this.roomServerAssignmentsDB.zrem('activeRooms', this.guid);
    pubsubManager.unsubscribe('room:'+this.guid, this.pubSubMessageHandler);
    console.log("Destroyed room " + this.guid + " - " + this.name);
    this.emit('empty');
}


module.exports = Room;