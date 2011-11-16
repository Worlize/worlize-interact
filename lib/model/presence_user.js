var sys = require('sys'),
    events = require('events'), 
    redisConnectionManager = require('./redis_connection_manager'),
    pubsubManager = require('./pubsub_manager'),
    PresenceStatusChangeMessage = require('../rpc/presence_messages/presence_status_change'),
    MessageEncoder = require('../rpc/message_encoder'),
    UserState = require('./user_state'),
    Log = require('../util/log');
    
var logger = Log.getLogger('model.PresenceUser');
    
var PresenceUser = function(guid, userName) {
    this.guid = guid;
    this.userName = userName;
    this.session = null;
    this.currentRoom = null;
    this.position = [ 0, 0 ];
    this.state = null;
};

PresenceUser.load = function(guid, userName, callback) {
    var user = new User(guid, userName);
    user.loadData(callback);
};

PresenceUser.presenceStatusIds = {
    'offline': 0,
    'online': 1,
    'idle': 2,
    'away': 3,
    'invisible': 4
};

PresenceUser.presenceStatuses = [
    'offline', // 'offline' is also optionally represented by a zero value
    'online',
    'idle',
    'away',
    'invisible'
];

PresenceUser.prototype.setPresenceStatus = function(presenceStatus) {
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

PresenceUser.prototype.getPresenceStatus = function(callback) {
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

PresenceUser.prototype.notifyFriendsOfStatusChange = function(presenceStatus) {
    var self = this;
    var redis = redisConnectionManager.getClient('relationships');
    redis.sunion(this.guid + ':friends', this.guid + ':fbFriends', function(err, members) {
        if (err) {
            logger.error("[" + self.guid + "] Unable to get friends to send presence notification.");
            return;
        }
        var message = new PresenceStatusChangeMessage();
        message.user = self;
        message.presenceStatus = presenceStatus;
        var encodedMessage = MessageEncoder.encode(message.getSerializableHash());
        for (var i=0,len=members.length; i < len; i++) {
            var member = members[i];
            pubsubManager.publish("user:" + member, encodedMessage);
        }
    });
};
PresenceUser.prototype.subscribeToPubSubChannel = function() {
    logger.debug2("Subscribing to user channel: user:" + this.guid);
    this.pubSubMessageHandler = this.handlePubSubMessage.bind(this);
    pubsubManager.subscribe("user:" + this.guid, this.pubSubMessageHandler);
};
PresenceUser.prototype.unsubscribeFromPubSubChannel = function() {
    logger.debug2("Unsubscribing from user channel: user:" + this.guid);
    if (this.pubSubMessageHandler) {
        pubsubManager.unsubscribe("user:" + this.guid, this.pubSubMessageHandler);
    }
};
PresenceUser.prototype.handlePubSubMessage = function(message) {
    try {
        message = MessageEncoder.decode(message);
        this.session.client.send(MessageEncoder.encode(message));
    }
    catch (e) {
        logger.error("Error while forwarding message to user from control channel: " + e);
    }
};
PresenceUser.prototype.destroy = function() {
    if (this.presenceStatusUpdateInterval) {
        clearInterval(this.presenceStatusUpdateInterval);
    }
};
PresenceUser.prototype.sendMessage = function(message) {
    if (this.session.client.connected) {
        message.send(this.session.client);
    }
};

module.exports = User;