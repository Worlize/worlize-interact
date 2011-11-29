var events = require('events'), 
    redisConnectionManager = require('./redis_connection_manager'),
    pubsubManager = require('./pubsub_manager'),
    PresenceStatusChangeMessage = require('../rpc/presence_messages/presence_status_change'),
    MessageEncoder = require('../rpc/message_encoder'),
    Log = require('../util/log');
    
var logger = Log.getLogger('model.PresenceUser');
    
var PresenceUser = function(guid, userName) {
    this.guid = guid;
    this.userName = userName;
    this.session = null; // a reference to the Session model object
    this.connection = null; // a reference to the WebSocketConnection
};

PresenceUser.load = function(guid, userName, callback) {
    var user = new PresenceUser(guid, userName);
    
    // Nothing to load right now, so we callback immediately
    callback(null, user);
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
    var statusId = PresenceUser.presenceStatusIds[presenceStatus];
    if (typeof(statusId) !== 'number') {
        // invalid status
        return;
    }
    
    logger.debug("Setting presence to " + presenceStatus, this.logNotation);
    
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
        redis.del('status:' + this.guid, function(err, result) {
            if (err) {
                // Something went wrong with redis!
                logger.error("Error while deleting redis presence info for user: " + err.toString(), self.logNotation);
            }
        });
    }
    else {
        var statusUpdateFunction = function() {
            // Expires after five minutes in case the server dies without
            // being able to clean up after itself.
            redis.setex('status:' + self.guid, 300, statusId.toString(), function(err, result) {
                if (err) {
                    // Something went wrong with redis!
                    logger.error("Error while updating redis presence info for user: " + err.toString(), self.logNotation);
                }
            });
        };
        
        // Update Redis every four minutes so the key doesn't expire
        this.presenceStatusUpdateInterval = setInterval(statusUpdateFunction, 240000);
        statusUpdateFunction();
    }
    this.notifyFriendsOfStatusChange(presenceStatus);
};

PresenceUser.prototype.getPresenceStatus = function(callback) {
    var self = this;
    var redis = redisConnectionManager.getClient('presence');
    redis.get('status:' + user.guid, function(err, result) {
        if (err) {
            logger.error("Error while loading redis presence info for user: " + err.toString(), self.logNotation);
            callback(err);
            return;
        }
        if (result === null) {
            callback(null, 'offline');
            return;
        }
        callback(null, PresenceUser.presenceStatuses[result]);
    });
}

PresenceUser.prototype.notifyFriendsOfStatusChange = function(presenceStatus) {
    var self = this;
    var redis = redisConnectionManager.getClient('relationships');
    redis.sunion(this.guid + ':friends', this.guid + ':fbFriends', function(err, members) {
        if (err) {
            logger.error("Unable to get friends to send presence notification.", self.logNotation);
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
    logger.debug2("Subscribing to user channel", this.logNotation);
    this.pubSubMessageHandler = this.handlePubSubMessage.bind(this);
    pubsubManager.subscribe("user:" + this.guid, this.pubSubMessageHandler);
};

PresenceUser.prototype.unsubscribeFromPubSubChannel = function() {
    logger.debug2("Unsubscribing from user channel", this.logNotation);
    if (this.pubSubMessageHandler) {
        pubsubManager.unsubscribe("user:" + this.guid, this.pubSubMessageHandler);
    }
};

PresenceUser.prototype.handlePubSubMessage = function(message) {
    var self = this;
    try {
        decodedMessage = MessageEncoder.decode(message);
        this.connection.send(message);
    }
    catch (e) {
        logger.error("Error while forwarding message to user from control channel: " + e.toString(), self.logNotation);
    }
};

PresenceUser.prototype.destroy = function() {
    if (this.presenceStatusUpdateInterval) {
        clearInterval(this.presenceStatusUpdateInterval);
    }
};

PresenceUser.prototype.sendMessage = function(message) {
    if (this.connection.connected) {
        message.send(this);
    }
};

module.exports = PresenceUser;