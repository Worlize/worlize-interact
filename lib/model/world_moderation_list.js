var events = require('events'),
    User = require('./user'),
    Log = require('../util/log'),
    redisConnectionManager = require('./redis_connection_manager');

var logger = Log.getLogger('model.ModerationList');

var WorldModerationList = function() {
    this.worldGuid = null;
    
    this.defaultPinDuration = 600000; // 10 minutes
    this.defaultKillDuration = 3600000; // 1 hour
    this.defaultGagDuration = 600000; // 10 minutes
    this.defaultAvatarGagDuration = 600000; // 10 minutes
    
    // Keyed by user guid
    this.pinned = {};
    this.killed = {};
    this.gagged = {};
    this.avatarGagged = {};
};

WorldModerationList.load = function(worldGuid, callback) {
    var redis = redisConnectionManager.getClient('room_definitions');
    var list = new WorldModerationList();
    list.worldGuid = worldGuid;
    
    if (!worldGuid) {
        callback(new Error("You must provide a world guid to retrieve the moderation list."));
    }
    redis.hget(
        "moderationList", worldGuid,
        function(err, data) {
            var decodedData;
            if (err) {
                callback(err);
                return;
            }
            if (data === null) {
                decodedData = {
                    "sv":1,
                    "pin":[],
                    "kill":[],
                    "gag":[],
                    "avgag":[]
                }
                return;
            }
            else {
                try {
                    decodedData = JSON.parse(data);
                }
                catch (e) {
                    // JSON Parsing Error
                    callback(e);
                    return;
                }
            }
            
            try {
                list.parseData(data);
            }
            catch(e) {
                callback(e);
                return;
            }
            
            logger.debug("Successfully loaded moderation list for " + worldGuid);
            callback(null, list);
        }
    );
};

WorldModerationList.prototype.isUserKilled = function(userGuid) {
    var record = this.killed[userGuid];
    return record && record.expires > (new Date()).valueOf();
};

WorldModerationList.prototype.isUserPinned = function(userGuid) {
    var record = this.pinned[userGuid];
    return record && record.expires > (new Date()).valueOf();
};

WorldModerationList.prototype.isUserGagged = function(userGuid) {
    var record = this.pinned[userGuid];
    return record && record.expires > (new Date()).valueOf();
};

WorldModerationList.prototype.isUserAvatarGagged = function(userGuid) {
    var record = this.pinned[userGuid];
    return record && record.expires > (new Date()).valueOf();
};

WorldModerationList.prototype.killUser = function(moderator, user, duration) {
    if (typeof(duration) !== 'number') {
        duration = this.defaultKillDuration;
    }
    this.killed[user] = {
        moderator: moderator,
        expires: (new Date()).valueOf() + duration
    };
};

WorldModerationList.prototype.pinUser = function(moderator, user, duration) {
    if (typeof(duration) !== 'number') {
        duration = this.defaultPinDuration;
    }
    this.pinned[user] = {
        moderator: moderator,
        expires: (new Date()).valueOf() + duration
    };
};

WorldModerationList.prototype.gagUser = function(moderator, user, duration) {
    if (typeof(duration) !== 'number') {
        duration = this.defaultGagDuration;
    }
    this.gagged[user] = {
        moderator: moderator,
        expires: (new Date()).valueOf() + duration
    };
};

WorldModerationList.prototype.avatarGagUser = function(moderator, user, duration) {
    if (typeof(duration) !== 'number') {
        duration = this.defaultAvatarGagDuration;
    }
    this.avatarGagged[user] = {
        moderator: moderator,
        expires: (new Date()).valueOf() + duration
    };
};


/*

Record template:
{
    user: "oaiwejfawioefjwaeoij",
    expires: 49832953283, // new Date(val), (new Date()).valueOf()
    moderator: "moderatorGuid" // the guid of the user who performed the moderation
}

*/


WorldModerationList.prototype.parseData = function(data) {
    if (!data.kill) {
        throw new Error("Data is missing 'kill' key");
    }
    if (!data.gag) {
        throw new Error("Data is missing 'gag' key");
    }
    if (!data.pin) {
        throw new Error("Data is missing 'pin' key");
    }
    if (!data.avgag) {
        throw new Error("Data is missing 'avgag' key");
    }
    
    this.killed = raw.kill;
    this.pinned = raw.pin;
    this.gagged = raw.gag;
    this.avatarGagged = raw.avgag;
};

WorldModerationList.prototype.getSerializableHash = function() {
    return {
        kill: this.killed,
        pin: this.pinned,
        gag: this.gagged,
        avgag: this.avatarGagged
    };
};

WorldModerationList.prototype.save = function(callback) {
    if (typeof(callback) !== 'function') { callback = function(){}; }
    this.cleanExpiredItems();
    
    if (Object.keys(this.killed).length === 0 &&
        Object.keys(this.pinned).length === 0 &&
        Object.keys(this.gagged).length === 0 &&
        Object.keys(this.avatarGagged).length === 0)
    {
        redis.hdel("moderationList", worldGuid, function(err, result) {
            if (err) {
                callback(err);
                return;
            }
            callback(null);
        });  
    }
    else {
        redis.hset(
            "moderationList", this.worldGuid,
            JSON.stringify(this.getSerializableHash()),
            function(err, data) {
                if (err) {
                    callback(err); // failure
                    return;
                }
                callback(null); // success
            }
        );
    }
};

WorldModerationList.prototype.cleanExpiredItems = function() {
    var now = (new Date()).valueOf();
    for (var userGuid in this.killed) {
        var killRec = this.killed[userGuid];
        if (killRec.expires <= now) {
            delete this.killed[userGuid];
        }
    }
    for (var userGuid in this.pinned) {
        var pinRec = this.pinned[userGuid];
        if (pinRec.expires <= now) {
            delete this.pinned[userGuid];
        }
    }
    for (var userGuid in this.gagged) {
        var gagRec = this.gagged[userGuid];
        if (gagRec.expires <= now) {
            delete this.gagged[userGuid];
        }
    }
    for (var userGuid in this.avatarGagged) {
        var avgagRec = this.avatarGagged[userGuid];
        if (avgagRec.expires <= now) {
            delete this.avatarGagged[userGuid];
        }
    }
};

module.exports = WorldModerationList;
