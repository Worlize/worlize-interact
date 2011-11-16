var sys = require('sys'),
    redisConnectionManager = require('./redis_connection_manager'),
    Log = require('../util/log');
    
var logger = Log.getLogger('model.UserState');

var twentyFourHours = 60 * 60 * 24;

var UserState = function(userGuid) {
    this.userGuid = userGuid;
    this.avatar = null;
    this.face = Math.round(Math.random() * 12);
    this.color = Math.round(Math.random() * 15);
    this.saveTimeout = null;
}

UserState.load = function(userGuid, callback) {
    var redis = redisConnectionManager.getClient('presence');
    var state = new UserState(userGuid);
    redis.get('userState:' + userGuid, function(err, data) {
        if (err) {
            callback(err);
        }
        else if (data === null) {
            state.save();
            callback(null, state);
            return;
        }
        
        try {
            result = JSON.parse(data);
        }
        catch (e) {
            // do nothing
            callback("Unable to load user state: " + e.toString());
            return;
        }
        state.avatar = result.avatar;
        state.face = result.face;
        state.color = result.color;
        
        callback(null, state);
    });
};

UserState.prototype.getSerializableHash = function() {
    return {
        avatar: this.avatar,
        face: this.face,
        color: this.color
    };
};
UserState.prototype.save = function(callback) {
    var self = this;

    if (this.saveTimeout) {
        clearTimeout(this.saveTimeout);
    }
    this.saveTimeout = setTimeout(function() {
        self.redis.setex(
            'userState:' + self.userGuid,
            twentyFourHours,
            JSON.stringify(self.getSerializableHash()),
            function(err, result) {
                if (err) {
                    logger.error("There was an error while saving user state: " + err, "[]{" + self.userGuid + "}");
                    if (typeof(callback) === 'function') {
                        callback("Unable to save state: " + err.toString());
                    }
                }
                if (typeof(callback) === 'function') {
                    callback(null);
                }
            }
        );
    }, 250);
    
};

module.exports = UserState;