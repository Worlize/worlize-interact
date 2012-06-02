var events = require('events'),
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
    this.serverId = null;
    this.facebookId = null;
};

Session.load = function(sessionGuid, callback) {
    var redis = redisConnectionManager.getClient('presence');
    var session = new Session();
    session.guid = sessionGuid;
    
    if (sessionGuid) {
        redis.hget(
            "session", sessionGuid,
            function(err, data) {
                var decodedData;
                if (err) {
                    callback(err);
                    return;
                }
                if (data === null) {
                    callback("Session doesn't exist");
                    return;
                }
                try {
                    decodedData = JSON.parse(data);
                }
                catch (e) {
                    // JSON Parsing Error
                    callback(e);
                    return;
                }
                
                session.userName = decodedData.username;
                session.userGuid = decodedData.user_guid;
                session.worldGuid = decodedData.world_guid;
                session.roomGuid = decodedData.room_guid;
                session.serverId = decodedData.server_id;
                session.facebookId = decodedData.facebook_id;
                
                logger.debug("Successfully loaded session guid: " + sessionGuid +
                              " Username: " + session.userName +
                              " WorldGuid: " + session.worldGuid +
                              " RoomGuid: " + session.roomGuid +
                              " FacebookId: " + session.facebookId,
                              { user: session.userGuid }
                            );
                callback(null, session);
            }
        );
    }
    else {
        callback("You must provide a valid guid to load");
    }
};

module.exports = Session;
