var sys = require('sys'),
    kiwi = require('kiwi'),
    events = require('events'),
    redisConnectionManager = require('./redis_connection_manager').connectionManager;

var Session = function() {
    this.guid = guid;
    this.log = sys.log;
    this.redis = redisConnectionManager.getClient('presence');
    this._data = {};
};
Session.prototype = {

};

Session.load = function(sessionId, callback) {
    var session = new Session();
    var fail = function(err) {
        if (callback && typeof(callback) === 'function') {
            callback(err, null);
        }
        session.emit("loadError", err);
    };
    
    if (sessionId) {
        session.redis.hget(
            "session", sessionId,
            function(err, data) {
                if (err) {
                    fail(err);
                    return;
                }
                if (data === null) {
                    fail("Session doesn't exist");
                    return;
                }
                try {
                    session._data = JSON.parse(data.toString('utf8'));
                    session.screenName = session._data.screen_name;
                    session.userGuid = session._data.user_guid;
                    session.worldGuid = session._data.world_guid;
                    session.roomGuid = session._data.room_guid;
                }
                catch (e) {
                    // JSON Parsing Error
                    fail(e);
                    return;
                }
                
                // Successfully decoded session.
                if (callback && typeof(callback) === 'function') {
                    callback(null, session);
                    session.emit("loaded", session);
                }
            }
        );
    }
    else {
        throw new Error("You must provide a valid guid to load");
    }
    return session;
};

sys.inherits(Session, events.EventEmitter);

exports.Session = Session;
