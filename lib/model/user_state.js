var sys = require('sys'),
    events = require('events'),
    redisConnectionManager = require('./redis_connection_manager'),
    Log = require('../util/log');
    
var logger = Log.getLogger('model.UserState');

var twentyFourHours = 60 * 60 * 24;

var UserState = function(userGuid) {
    this.redis = redisConnectionManager.getClient('presence');
    this.userGuid = userGuid;
    this.avatar = null;
    this.face = Math.round(Math.random() * 12);
    this.color = Math.round(Math.random() * 15);
    this.saveTimeout = null;
}
sys.inherits(UserState, events.EventEmitter);

UserState.prototype.loadData = function() {
    var self = this;
    this.redis.get('userState:' + this.userGuid, function(err, data) {
        var error = true;
        if (!err) {
            try {
                data = data.toString('utf8');
            }
            catch (e) {
                // do nothing
            }
            try {
                result = JSON.parse(data);
                self.avatar = result.avatar;
                self.face = result.face;
                self.color = result.color;
                error = false;
            }
            catch (e) {
                // do nothing
            }
        }
        if (error) {
            // since we couldn't read the existing user state, we'll
            // go ahead and save our newly initialized object.
            self.save();
        }
        self.emit('ready');
    });
};
UserState.prototype.getSerializableHash = function() {
    return {
        avatar: this.avatar,
        face: this.face,
        color: this.color
    };
};
UserState.prototype.save = function() {
    var self = this;

    if (this.saveTimeout) {
        clearTimeout(this.saveTimeout);
    }
    this.saveTimeout = setTimeout(function() {
        self.redis.set(
            'userState:' + self.userGuid,
            JSON.stringify(self.getSerializableHash()),
            function(err) {
                if (err) {
                    logger.error("There was an error while saving user state: " + err);
                    self.emit("saveError");
                }
                else {
                    self.redis.expire('userState:' + self.userGuid, twentyFourHours);
                    self.emit("saved");
                }
            }
        );
    }, 250);
    
};

module.exports = UserState;