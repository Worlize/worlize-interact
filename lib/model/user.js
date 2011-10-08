var sys = require('sys'),
    events = require('events'), 
    redisConnectionManager = require('./redis_connection_manager'),
    pubsubManager = require('./pubsub_manager'),
    PresenceStatusChangeMessage = require('../rpc/presence_messages/presence_status_change'),
    MessageEncoder = require('../rpc/message_encoder'),
    UserState = require('./user_state');
    
var User = function(guid, userName) {
    var self = this;

    this.guid = guid;
    this.userName = userName;
    this.session = null;
    this.currentRoom = null;
    this.position = [ 0, 0 ];
    
    this.state = new UserState(this.guid);
    this.state.on('ready', function() {
        self.emit('ready');
    });
};
sys.inherits(User, events.EventEmitter);

User.presenceStatusIds = {
    'offline': 0,
    'online': 1,
    'idle': 2,
    'away': 3,
    'invisible': 4
};

User.presenceStatuses = [
    'offline', // 'offline' is also optionally represented by a zero value
    'online',
    'idle',
    'away',
    'invisible'
];

User.prototype.setPresenceStatus = function(presenceStatus) {
    var self = this;
    var statusId = User.presenceStatusIds[presenceStatus];
    if (typeof(statusId) !== 'number') {
        // invalid status
        return;
    }
    
    this.presenceStatus = presenceStatus;

    var redis = redisConnectionManager.getClient('presence');

    // Cancel any previously scheduled status refreshes.
    if (this.presenceStatusUpdateInterval) {
        clearInterval(this.presenceStatusUpdateInterval);
        this.presenceStatusUpdateInterval = null;
    }
    
    // an 'offline' status is represented by the absense of a key in Redis
    // ... why waste prescious memory on users that aren't online?
    if (presenceStatus === 'offline') {
        redis.del('status:' + this.guid);
    }
    else {
        var statusUpdateFunction = function() {
            // Expires after five minutes in case the server dies without
            // being able to clean up after itself.
            redis.setex('status:' + self.guid, 300, statusId.toString());
        };
        
        // Update Redis every four minutes so the key doesn't expire
        this.presenceStatusUpdateInterval = setInterval(statusUpdateFunction, 240000);
        statusUpdateFunction();
    }
    this.notifyFriendsOfStatusChange(presenceStatus);
};

User.prototype.getPresenceStatus = function(callback) {
    if (typeof(callback) !== 'function') {
        throw new Error("You must specify a callback to getPresenceStatus");
        return;
    }
    var redis = redisConnectionManager.getClient('presence');
    redis.get('status:' + user.guid, function(err, result) {
        if (err) {
            callback(err);
            return;
        }
        if (result === null) {
            callback(null, 'offline');
            return;
        }
        callback(null, User.presenceStatuses[result]);
    });
}

User.prototype.notifyFriendsOfStatusChange = function(presenceStatus) {
    var self = this;
    var redis = redisConnectionManager.getClient('relationships');
    redis.sunion(this.guid + ':friends', this.guid + ':fbFriends', function(err, members) {
        if (err) {
            console.log("[" + self.guid + "] Unable to get friends to send presence notification.");
            return;
        }
        var message = new PresenceStatusChangeMessage();
        message.user = self;
        message.presenceStatus = presenceStatus;
        var encodedMessage = MessageEncoder.encode(message.serializedMessage());
        for (var i=0,len=members.length; i < len; i++) {
            var member = members[i];
            pubsubManager.publish("user:" + member, encodedMessage);
        }
    });
};
User.prototype.subscribeToPubSubChannel = function() {
    console.log("Subscribing to user channel: user:" + this.guid);
    this.pubSubMessageHandler = this.handlePubSubMessage.bind(this);
    pubsubManager.subscribe("user:" + this.guid, this.pubSubMessageHandler);
};
User.prototype.unsubscribeFromPubSubChannel = function() {
    console.log("Unsubscribing from user channel: user:" + this.guid);
    if (this.pubSubMessageHandler) {
        pubsubManager.unsubscribe("user:" + this.guid, this.pubSubMessageHandler);
    }
};
User.prototype.handlePubSubMessage = function(message) {
    try {
        message = MessageEncoder.decode(message);
        this.session.client.send(MessageEncoder.encode(message));
    }
    catch (e) {
        console.log("Error while forwarding message to user from control channel: " + e);
    }
};
User.prototype.loadData = function() {
    this.state.loadData();  
};
User.prototype.destroy = function() {
    if (this.currentRoom) {
        console.log("Exiting current room");
        this.currentRoom.userLeave(this.guid);
    }
    if (this.presenceStatusUpdateInterval) {
        clearInterval(this.presenceStatusUpdateInterval);
    }
};
User.prototype.sendMessage = function(message) {
    if (this.session.client.connected) {
        message.send(this.session.client);
    }
};

module.exports = User;