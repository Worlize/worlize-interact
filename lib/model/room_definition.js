var Log = require('../util/log'),
    events = require('events'),
    redisConnectionManager = require('./redis_connection_manager');

var logger = Log.getLogger('model.RoomDefinition');

RoomDefinition = function(roomGuid) {
    events.EventEmitter.call(this);
    this.roomGuid = roomGuid;
    this.name = null;
    this.ownerGuid = null;
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

RoomDefinition.prototype.load = function(callback) {
    var self = this;

    var multi = this.redis.multi();
    multi.hget('roomDefinition', this.roomGuid);
    multi.hget('hotspots', this.roomGuid);
    multi.hget('embedded_youtube_players', this.roomGuid);
    multi.hget('in_world_objects', this.roomGuid);
    multi.exec(function(err, replies) {
        if (err) {
            logger.error("Redis error loading room definition for room " + self.roomGuid + ": " + err.toString());
            callback(err);
            return;
        }
        var roomDefinition = replies[0];
        var hotspots = replies[1];
        var embeddedYoutubePlayers = replies[2];
        var inWorldObjects = replies[3];
        
        if (roomDefinition === null) {
            logger.error("Room " + self.guid + " does not exist.");
            callback("Room " + self.guid + " does not exist.");
            return;
        }
        try {
            roomDefinition = JSON.parse(roomDefinition);
            if (hotspots !== null) {
                hotspots = JSON.parse(hotspots);
            }
            if (embeddedYoutubePlayers !== null) {
                embeddedYoutubePlayers = JSON.parse(embeddedYoutubePlayers);
            }
            if (inWorldObjects !== null) {
                inWorldObjects = JSON.parse(inWorldObjects);
            }
        }
        catch(e) {
            logger.error("JSON Parsing error loading room definition: " + e.toString());
            callback("JSON Parsing Error: " + e.toString());
            return;
        }

        self.name = roomDefinition.name;
        self.worldGuid = roomDefinition.world_guid;
        self.ownerGuid = roomDefinition.owner_guid;
        self.background = roomDefinition.background;
        self.properties = roomDefinition.properties || {};
        self.hotspots = Array.isArray(hotspots) ? hotspots : [];
        self.objects = Array.isArray(inWorldObjects) ? inWorldObjects : [];
        self.youtubePlayers = Array.isArray(embeddedYoutubePlayers) ? embeddedYoutubePlayers : [];

        callback(null);
    });
};

RoomDefinition.prototype.updateProperty = function(name, value, callback) {
    var self = this;
    var originalValue = this.properties[name];
    // validate that property can be JSON encoded
    try {
        var temp = JSON.stringify({name:name,value:value});
    }
    catch(e) {
        // Bail out.
        callback("Property is not JSON serializable: " + e.toString());
        return;
    }
    this.properties[name] = value;
    this.save(function(err, result) {
        if (err) {
            // If something goes wrong, revert to the original value
            self.properties[name] = originalValue;
        }
        callback(err, result);
    });
};

RoomDefinition.prototype.save = function(callback) {
    logger.info("action=save_room_definition Saving room definition.");
    this.redis.hset('roomDefinition', this.roomGuid, JSON.stringify({
        name: this.name,
        world_guid: this.worldGuid,
        owner_guid: this.ownerGuid,
        background: this.background,
        properties: this.properties
    }), function(err, result) {
        if (err) {
            callback("Unable to save room definition: " + err);
            logger.error("Unable to save room definition: " + err);
            return;
        }
        callback(null);
    });
};

RoomDefinition.prototype.getSerializableHash = function() {
    return {
        name: this.name,
        guid: this.roomGuid,
        world_guid: this.worldGuid,
        background: this.background,
        hotspots: this.hotspots,
        objects: this.objects,
        youtube_players: this.youtubePlayers,
        properties: this.properties
    };
};

module.exports = RoomDefinition;