var sys = require('sys'),
    events = require('events'),
    redisConnectionManager = require('./redis_connection_manager');

var Session = function() {
    this.guid = null;
    this._data = {
        userName: null,
        userGuid: null,
        worldGuid: null,
        roomGuid: null,
        user: null,
        world: null,
        room: null
    };
};
Session.prototype = {

};

Session.load = function(sessionGuid, callback) {
    var redis = redisConnectionManager.getClient('presence');
    var session = new Session();
    session.guid = sessionGuid;
    var fail = function(err) {
        if (callback && typeof(callback) === 'function') {
            callback(err, null);
        }
        session.emit("loadError", err);
    };
    
    if (sessionGuid) {
        redis.hget(
            "session", sessionGuid,
            function(err, data) {
                var decodedData;
                if (err) {
                    fail(err);
                    return;
                }
                if (data === null) {
                    fail("Session doesn't exist");
                    return;
                }
                try {
                    decodedData = JSON.parse(data.toString('utf8'));
                }
                catch (e) {
                    // JSON Parsing Error
                    fail(e);
                    return;
                }
                
                session.userName = decodedData.username;
                session.userGuid = decodedData.user_guid;
                session.worldGuid = decodedData.world_guid;
                session.roomGuid = decodedData.room_guid;
                
                // Successfully decoded session.
                if (callback && typeof(callback) === 'function') {
                    callback(null, session);
                }
                session.emit("loaded", session);
            }
        );
    }
    else {
        fail("You must provide a valid guid to load");
    }
    return session;
};

sys.inherits(Session, events.EventEmitter);

module.exports = Session;
