var Log = require('../util/log'),
    events = require('events'),
    redisConnectionManager = require('./redis_connection_manager');

var logger = Log.getLogger('model.RoomData');

RoomDefinition = function(roomGuid) {
    events.EventEmitter.call(this);
    this.roomGuid = roomGuid;
    this.name = null;
    this.worldGuid = null;
    this.definition = null;
    this.redis = redisConnectionManager.getClient('room_definitions');
};

RoomDefinition.load = function(roomGuid, callback) {
    var definition = new RoomDefinition();
    definition.roomGuid = roomGuid;
    definition.load(function(err) {
        if (err) {
            callback(err);
            return;
        }
        callback(null, definition);
    });
};

RoomDefinition.migrateTo = {
    1: function(data, callback) {
        callback(null, data);
    },
    2: function(data, callback) {
        callback(null, data);
    }
};

RoomDefinition.schemaVersion = 2;

RoomDefinition.prototype.load = function(callback) {
    var self = this;

    this.redis.hget('roomDefinitionV2', this.roomGuid, function(err, result) {
        if (err) {
            logger.error("Redis error loading room definition for room " + self.roomGuid + ": " + err.toString());
            callback(err);
            return;
        }
        
        if (result === null) {
            logger.error("Room " + self.guid + " does not exist.");
            callback("Room " + self.guid + " does not exist.");
            return;
        }

        var roomDefinition = result;

        try {
            roomDefinition = JSON.parse(roomDefinition);
        }
        catch(e) {
            logger.error("JSON Parsing error while loading room definition: " + e.toString());
            callback("JSON Parsing Error: " + e.toString());
            return;
        }

        self['_sv'] = roomDefinition['_sv'];
        
        self.name = roomDefinition.name;
        self.worldGuid = roomDefinition.world_guid;
        self.background = roomDefinition.background;
        self.userRoles = roomDefinition.user_roles;
        self.items = roomDefinition.items;

        callback(null);
    });
};

RoomDefinition.prototype.migrate = function(data, callback) {
    var self = this;
    
    if (data['_sv'] === RoomDefinition.schemaVersion) {
        callback(null, data);
    }
    if (data['_sv'] > RoomDefinition.schemaVersion) {
        logger.error("Unable to perform data migration: version " +
                     data['_sv'] + " is newer than the latest known version.");
        callback("roomGuid=" + this.roomGuid +
                 " Unable to perform data migration: version " + data['_sv'] +
                 " is newer than the latest known version.");
        return;
    }
    var migrationFunction = RoomDefinition.migrateTo[data['_sv'] + 1];
    if (typeof(migrationFunction) !== 'function') {
        logger.error("roomGuid=" + this.roomGuid +
                     " Unable to perform data migration: no function" +
                     " available to migrate to version " + (data['_sv'] + 1));
        callback("no function available to migrate to version " + (data['_sv'] + 1));
        return;
    }
    migrationFunction(data, function(err, data) {
        if (err) {
            logger.error("roomGuid=" + self.roomGuid + " " + err.toString());
            callback(err);
        }
        self.migrate(data, callback);
    });
};

RoomDefinition.prototype.getSerializableHash = function() {
    return {
        name: this.name,
        guid: this.roomGuid,
        world_guid: this.worldGuid,
        background: this.background,
        items: this.items
    };
};

module.exports = RoomDefinition;