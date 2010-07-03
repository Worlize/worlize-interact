var sys = require('sys'),
    kiwi = require('kiwi'),
    Class = kiwi.require('Class').Class,
    redisConnectionManager = require('./redis_connection_manager').connectionManager,
    redis = redisConnectionManager.getClient('presence');

var Session = new Class({
    _data: {},
    constructor: function(guid) {
        this.guid = guid;
    },
    load: function(callback) {
        if (this.guid) {
            redis.get(
                "session:" + this.guid,
                function(err, data) {
                    if (err) {
                        sys.log("Error loading session data for " + this.guid);
                        if (callback && typeof(callback) === 'function')
                            callback(err, null);
                        return;
                    }
                    this._data = JSON.parse(data.toString('utf8'));

                    if (callback && typeof(callback) === 'function') {
                        callback(null, this._data);
                    }
                }.bind(this)
            );
        }
        else {
            throw new Error("You must provide a valid guid to load");
        }
    },
});

Session.load = function(sessionId, callback) {
    var session = new Session(sessionId);
    session.load(callback);
    return session;
};

exports.Session = Session;
