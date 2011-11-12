var sys = require('sys'),
    events = require('events'),
    User = require('./user'),
    Log = require('../util/log'),
    redisConnectionManager = require('./redis_connection_manager');

var logger = Log.getLogger('model.Session');

var Session = function() {
    this.guid = null;
    this.username = null;
    this.userGuid = null;
    this.worldGuid = null;
    this.roomGuid = null;
};

Session.load = function(sessionGuid, callback) {
    var redis = redisConnectionManager.getClient('presence');
    var session = new Session();
    session.guid = sessionGuid;
    var fail = function(err) {
        callback(err, null);
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
                    decodedData = JSON.parse(data);
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
                
                logger.debug("Successfully loaded session " + sessionGuid);
                logger.debug2("Session " + sessionGuid +
                              " UserGuid: " + session.userGuid +
                              " Username: " + session.userName +
                              " WorldGuid: " + session.worldGuid +
                              " RoomGuid: " + session.roomGuid);
                callback(null, session);
            }
        );
    }
    else {
        fail("You must provide a valid guid to load");
    }
};

module.exports = Session;
