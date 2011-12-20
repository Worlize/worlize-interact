var util = require('util'),
    events = require('events'),
    config = require('../config'),
    UserEnterMessage = require('../rpc/chatserver_messages/user_enter'),
    UserLeaveMessage = require('../rpc/chatserver_messages/user_leave'),
    RoomDefinitionMessage = require('../rpc/chatserver_messages/room_definition'),
    RoomDefinition = require('./room_definition'),
    SetVideoServerMessage = require('../rpc/chatserver_messages/set_video_server'),
    DisconnectMessage = require('../rpc/chatserver_messages/disconnect'),
    RoomPopulationUpdateMessage = require('../rpc/chatserver_messages/room_population_update'),
    MessageEncoder = require('../rpc/message_encoder'),
    redisConnectionManager = require('./redis_connection_manager'),
    pubsubManager = require('./pubsub_manager'),
	streamingServerBalancer = require('./streaming_server_balancer'),
	Log = require('../util/log');
	
var logger = Log.getLogger('model.Room');

var Room = function(chatserver, guid) {
    events.EventEmitter.call(this);
    var self = this;
    this.roomServerAssignmentsDB = redisConnectionManager.getClient('room_server_assignments');

    if (!chatserver) {
        throw new Error("You must provide a chatserver instance.")
    }

    this.guid = guid;
    this.chatserver = chatserver;
    this.definition = null;
    this.users = [];
    this.usersByUserGuid = {};
	this.streamingServer = "rtmp://" + streamingServerBalancer.getServer() + "/videochat";
    
    // Update redis database to reflect that this room is hosted here
    this.refreshRedisServerAssignmentKey();
    // Refresh redis key every 4:30
    this.redisServerAssignmentIntervalID = setInterval(this.refreshRedisServerAssignmentKey.bind(this), 270000);
    
    this.roomServerAssignmentsDB.sadd('roomsOnServer:'+this.chatserver.serverId, this.guid);
    this.roomServerAssignmentsDB.del('roomUsers:'+this.guid);
    this.roomServerAssignmentsDB.zadd('activeRooms', 0, this.guid);
    
    this.pubSubMessageHandler = this.handlePubSubMessage.bind(this);
    pubsubManager.subscribe("room:"+this.guid, this.pubSubMessageHandler);
    
    this.worldPubSubMessageHandler = this.handleWorldPubSubMessage.bind(this);
    // Will subscribe to the world broadcast channel when we find out what
    // the world guid is.
};
util.inherits(Room, events.EventEmitter);

Room.prototype.load = function(callback) {
    var self = this;
    logger.debug2("Loading room " + this.guid);
    RoomDefinition.load(this.guid, function(err, result) {
        if (err) {
            callback(err);
            return;
        }
        self.definition = result;
        logger.info("Room " + self.guid + " definition loaded. Name: " + result.name);
        
        // Now that we know the world guid, we can subscribe to the world
        // broadcast channel.
        pubsubManager.subscribe("world:" + self.definition.worldGuid, self.worldPubSubMessageHandler);
        callback(null);
    });
};

Room.prototype.reloadRoomDefinitionAndNotifyUsers = function() {
    var self = this;
    this.load(function(err, data) {
        if (err) {
            // TODO: Handle possible error
            return;
        }
        var roomDefinitionMessage = new RoomDefinitionMessage(self.chatserver);
        roomDefinitionMessage.roomDefinition = self.definition;
        self.broadcast(roomDefinitionMessage);
    });
};

Room.prototype.refreshRedisServerAssignmentKey = function() {
    // Redis key expires after 5:00
    this.roomServerAssignmentsDB.setex('serverForRoom:' + this.guid, 300, this.chatserver.serverId);
};

Room.prototype.addUser = function(user) {
    var self = this;
    
    logger.debug("Adding user " + user.guid + " to room " + this.guid, user.logNotation);

    // If this user is already in the room, something went wrong and we
    // need to boot the old incarnation of the user before continuing.
    var oldUser = this.usersByUserGuid[user.guid];
    if (oldUser) {
        logger.error("addUser: User already exists in room!  Disconnecting previous user.", user.logNotation);
        oldUser.connection.drop(1000);
    }

    // Select a random physical position in the room for the new user
    user.position = [
        60 + Math.floor(Math.random() * (config.roomWidth - 120)),
        60 + Math.floor(Math.random() * (config.roomHeight - 120))
    ];

    // Send the room definition to the new user
    var roomDefinitionMessage = new RoomDefinitionMessage(this.chatserver);
    roomDefinitionMessage.roomDefinition = this.definition;
    user.sendMessage(roomDefinitionMessage);
    
    // Tell the user which video server to connect to for this room
    var videoServerMessage = new SetVideoServerMessage(this.chatserver);
    videoServerMessage.room = this;
    user.sendMessage(videoServerMessage);
    
    // Send user_enter messages for all the existing occupants to the new entrant
    for (var i=0,len=this.users.length; i < len; i ++) {
        var userEnterMessage = new UserEnterMessage(this.chatserver);
        userEnterMessage.user = this.users[i];
        user.sendMessage(userEnterMessage);
    }

    // Add the user to the room's lists of users
    this.users.push(user);
    this.usersByUserGuid[user.guid] = user;
    
    // Set a reference to the room in the user object
    user.currentRoom = this;
    
    // Update the user list for the room in Redis and update the score in
    // the sorted set of active rooms
    var multi = this.roomServerAssignmentsDB.multi();
    multi.sadd('roomUsers:' + this.guid, user.guid);
    multi.zadd('activeRooms', this.users.length, this.guid);
    multi.exec(function(err, result) {
        if (err) {
            // Something went horribly wrong with redis!!
            logger.error("Disconnecting user: Redis error while updating room occupancy data: " + err, user.logNotation);
            setTimeout(function() {
                var disconnectMessage = new DisconnectMessage(self.chatserver);
                disconnectMessage.errorCode = 1004;
                disconnectMessage.errorMessage = "An error occurred on the server while joining the room.";
                user.sendMessage(disconnectMessage);
                user.connection.drop(1000); // 1000 = Normal WebSocket Close
            }, 100);
            return;
        }
    });
    
    // notify all users of the new entry
    var userEnterMessage = new UserEnterMessage(this.chatserver);
    userEnterMessage.user = user;
    this.broadcast(userEnterMessage);
    
    // Send a notification on the world global pubsub channel
    var populationUpdateMessage = new RoomPopulationUpdateMessage(this.chatserver);
    populationUpdateMessage.room = this;
    populationUpdateMessage.userAdded = user;
    pubsubManager.publish('world:' + this.definition.worldGuid, MessageEncoder.encode(populationUpdateMessage.getSerializableHash()));
};

Room.prototype.removeUser = function(user) {
    if (this.hasUser(user)) {
        logger.debug("User " + user.userName + " leaving room " + this.guid, user.logNotation);
        
        // notify all users of the user leaving
        var userLeaveMessage = new UserLeaveMessage(this.chatserver);
        userLeaveMessage.user = user;
        this.broadcast(userLeaveMessage);

        // Remove user from room's data structures
        this.users.splice(this.users.indexOf(user), 1);
        delete this.usersByUserGuid[user.guid];
        
        // Unset the reference to the current room in the user object
        user.currentRoom = null;
        
        // Update the user list for the room in Redis and update the score
        // in the sorted set of active rooms
        var multi = this.roomServerAssignmentsDB.multi();
        multi.srem('roomUsers:' + this.guid, user.guid);
        multi.zadd('activeRooms', this.users.length, this.guid);
        multi.exec(function(err, results) {
            if (err) {
                // Something went horribly wrong with redis!
                logger.error("Redis error while updating room occupancy data: " + err, user.logNotation);
            }
        });
        
        // Send a notification on the world global pubsub channel
        var populationUpdateMessage = new RoomPopulationUpdateMessage(this.chatserver);
        populationUpdateMessage.room = this;
        populationUpdateMessage.userRemoved = user;
        pubsubManager.publish('world:' + this.definition.worldGuid, MessageEncoder.encode(populationUpdateMessage.getSerializableHash()));

        if (this.users.length === 0) {
            this.destroy();
        }
    }
    else {
        logger.warn("Cannot remove user: they are not in the room!", user.logNotation);
    }
};

Room.prototype.hasUser = function(user) {
    return (this.usersByUserGuid[user.guid] === user);
};

Room.prototype.getUserByGuid = function(guid) {
    return this.usersByUserGuid[guid];
};

Room.prototype.broadcast = function(message, excludeUserGuid) {
    for (var i=0,len=this.users.length; i < len; i ++) {
        var user = this.users[i];
        if (user.guid !== excludeUserGuid) {
            user.sendMessage(message);
        }
    }
};

Room.prototype.handlePubSubMessage = function(message) {
    var self = this;
    var decodedMessage;
    try {
        decodedMessage = MessageEncoder.decode(message);
    }
    catch (e) {
        logger.error("Error while decoding message from room broadcast channel: " + e);
        return;
    }

    if (!('msg' in decodedMessage)) {
        logger.error("Message from room broadcast channel is missing the 'msg' key.  Message: " + message);
        return;
    }
    
    switch (decodedMessage.msg) {
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
            this.load(function(err, data) {
                if (err) {
                    // TODO: Handle possible errors?
                    
                    // The message should be forwarded to clients even if there
                    // is an error, for example when a room is being deleted
                    // it will send out object_removed messages but the actual
                    // room definition may no longer be available in the DB
                    // by the time we try to process this.
                }
                self.forwardMessageToUsers(decodedMessage);
            });
            break;
        default:
            this.forwardMessageToUsers(decodedMessage);
            break;
    }
};

Room.prototype.handleWorldPubSubMessage = function(message) {
    var self = this;
    var decodedMessage;
    try {
        decodedMessage = MessageEncoder.decode(message);
    }
    catch (e) {
        logger.error("Error while decoding message from world broadcast channel: " + e);
        return;
    }

    if (!('msg' in decodedMessage)) {
        logger.error("Message from world broadcast channel is missing the 'msg' key.  Message: " + message);
        return;
    }
    
    switch (decodedMessage.msg) {
        // currently no special handling for specific messages on the world
        // broadcast channel, just forward them to users.
        default:
            this.forwardMessageToUsers(decodedMessage);
            break;
    }
};

Room.prototype.forwardMessageToUsers = function(message) {
    var encodedMessage = MessageEncoder.encode(message);
    for (var i=0,len=this.users.length; i < len; i ++) {
        this.users[i].connection.send(encodedMessage);
    }
};

Room.prototype.destroy = function() {
    if (this.redisServerAssignmentIntervalID) {
        clearInterval(this.redisServerAssignmentIntervalID);
        this.redisServerAssignmentIntervalID = null;
    }
    var multi = this.roomServerAssignmentsDB.multi();
    multi.del('serverForRoom:' + this.guid);
    multi.srem('roomsOnServer:'+this.chatserver.serverId, this.guid);
    multi.del('roomUsers:'+this.guid);
    multi.zrem('activeRooms', this.guid);
    multi.exec(function(err, results) {
        if (err) {
            // Something went horribly wrong with redis!
            logger.error("Redis error while removing newly emptied room: " + err);
        }
    });
    pubsubManager.unsubscribe('room:' + this.guid, this.pubSubMessageHandler);
    if (this.definition) {
        pubsubManager.unsubscribe("world:" + this.definition.worldGuid, this.worldPubSubMessageHandler);
    }
    logger.info("Destroyed room " + this.guid + " - " + this.definition.name);
    this.emit('empty');
};


module.exports = Room;