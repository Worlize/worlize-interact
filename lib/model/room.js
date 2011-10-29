var sys = require('sys'),
    events = require('events'),
    config = require('../config'),
    UserEnterMessage = require('../rpc/chatserver_messages/user_enter'),
    UserLeaveMessage = require('../rpc/chatserver_messages/user_leave'),
    RoomDefinitionMessage = require('../rpc/chatserver_messages/room_definition'),
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
	this.ready = false;
    
    // Update redis database to reflect that this room is hosted here
    this.refreshRedisServerAssignmentKey();
    // Refresh redis key every 4:30
    this.redisServerAssignmentIntervalID = setInterval(this.refreshRedisServerAssignmentKey.bind(this), 270000);
    
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

Room.prototype.refreshRedisServerAssignmentKey = function() {
    // Redis key expires after 5:00
    this.roomServerAssignmentsDB.setex('serverForRoom:' + this.guid, 300, this.chatserver.serverId);
};

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

        // Send the room definition to the new user
        var roomDefinitionMessage = new RoomDefinitionMessage(this.chatserver);
        roomDefinitionMessage.roomDefinition = this.definition;
        newUser.sendMessage(roomDefinitionMessage);

        // notify all users of the new entry
        this.sendMessage(message);
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
Room.prototype.loadData = function(callback) {
    var self = this;
    function fail(err) {
        self.emit("loadError", err);
        if (typeof(callback) === 'function') {
            callback(err);
        }
    }
    
    var multi = self.redis.multi();
    multi.hget('roomDefinition', this.guid);
    multi.hget('hotspots', this.guid);
    multi.hget('embedded_youtube_players', this.guid);
    multi.hget('in_world_objects', this.guid);
    multi.exec(function(err, replies) {
        if (err) {
            fail(err);
            return;
        }
        var roomDefinition = replies[0];
        var hotspots = replies[1];
        var embeddedYoutubePlayers = replies[2];
        var inWorldObjects = replies[3];
        
        if (roomDefinition === null) {
            fail("Room " + self.guid + " does not exist.");
            return;
        }
        try {
            roomDefinition = JSON.parse(roomDefinition);
            if (hotspots !== null) {
                hotspots = JSON.parse(hotspots);
            }
            if (embeddedYoutubePlayers !== null) {
                embeddedYoutubePlayers = JSON.parse(embeddedYoutubePlayers);
            }
            if (inWorldObjects !== null) {
                inWorldObjects = JSON.parse(inWorldObjects);
            }
        }
        catch(e) {
            fail(e);
            return;
        }
        
        roomDefinition.hotspots = Array.isArray(hotspots) ? hotspots : [];
        roomDefinition.objects = Array.isArray(inWorldObjects) ? inWorldObjects : [];
        roomDefinition.youtube_players = Array.isArray(embeddedYoutubePlayers) ? embeddedYoutubePlayers : [];
        
        self.name = roomDefinition.name;
        self.worldGuid = roomDefinition.world_guid;
        self.definition = roomDefinition;

        if (typeof(callback) === 'function') {
            callback(null, self.definition);
        }
        self.ready = true;
        self.emit("ready");
    });
};
Room.prototype.reloadRoomDefinition = function() {
    var self = this;
    this.loadData();
};
Room.prototype.reloadRoomDefinitionAndNotifyUsers = function() {
    var self = this;
    this.loadData(function(err, data) {
        if (err) {
            // TODO: Handle possible error
            return;
        }
        var message = new RoomDefinitionMessage(self.chatserver);
        message.roomDefinition = self.definition;
        self.sendMessage(message);
    });
};
Room.prototype.handlePubSubMessage = function(message) {
    try {
        message = MessageEncoder.decode(message);
        switch (message.msg) {
            case "room_definition_updated":
                this.reloadRoomDefinitionAndNotifyUsers();
                break;
            
            // These messages need to trigger a room definition reload
            // TODO: Move this updating functionality from Ruby into the
            // interactivity server.
            case "hotspot_moved":
            case "hotspot_removed":
            case "hotspot_dest_updated":
            case "youtube_player_added":
            case "youtube_player_moved":
            case "youtube_player_data_updated":
            case "youtube_player_removed":
            case "new_object":
            case "object_moved":
            case "object_updated":
            case "object_removed":
                this.reloadRoomDefinition();
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
    if (this.redisServerAssignmentIntervalID) {
        clearInterval(this.redisServerAssignmentIntervalID);
        this.redisServerAssignmentIntervalID = null;
    }
    this.roomServerAssignmentsDB.del('serverForRoom:' + this.guid);
    this.roomServerAssignmentsDB.srem('roomsOnServer:'+this.chatserver.serverId, this.guid);
    this.roomServerAssignmentsDB.del('roomUsers:'+this.guid);
    this.roomServerAssignmentsDB.zrem('activeRooms', this.guid);
    pubsubManager.unsubscribe('room:'+this.guid, this.pubSubMessageHandler);
    console.log("Destroyed room " + this.guid + " - " + this.name);
    this.emit('empty');
}


module.exports = Room;