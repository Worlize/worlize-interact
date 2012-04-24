var Log = require('../util/log'),
    events = require('events'),
    redisConnectionManager = require('./redis_connection_manager');

var logger = Log.getLogger('model.RoomDefinition');

RoomDefinition = function(roomGuid) {
    events.EventEmitter.call(this);
    this.roomGuid = roomGuid;
    this.room = null;
    this.name = null;
    this.ownerGuid = null;
    this.worldGuid = null;
    this.background = null;
    this.properties = null;
    this.hotspots = null;
    this.objects = null;
    this.youtubePlayers = null;
    
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


RoomDefinition.prototype.handleRoomDefinitionUpdated = function(data) {
    var changes = data.changes;
    for (var key in changes) {
        var oldValue = changes[key][0];
        var newValue = changes[key][1];
        switch (key) {
            case "name":
                this.name = newValue;
                break;
            case "background":
                this.background = newValue;
                break;
        }
    }
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

        self.apps = self.objects.filter(function(item) {
            return item.kind === 'app';
        });
        
        // If there are no 'app' objects, we're done
        if (self.apps.length === 0) {
            callback(null);
            return;
        }
        
        // If there are, we have to load in their configs
        var multi2 = self.redis.multi();
        self.apps.forEach(function(app) {
            multi2.hget('app_config', app.guid);
        });
        logger.info("Loading config data for " + self.apps.length + " apps.");
        multi2.exec(function(err, replies) {
            if (err) {
                logger.error("Redis error loading app configs for room " + self.roomGuid + ": " + err.toString());
                callback(err);
                return;
            }
            for (var i=0,len=replies.length; i < len; i++) {
                var app = self.apps[i];
                var rawReply = replies[i];
                if (rawReply) {
                    try {
                        app.config = JSON.parse(rawReply);
                    }
                    catch(e) {
                        logger.error("JSON Parsing error while loading app config for app guid " + app.guid + ": " + e.toString());
                        app.config = {};
                    }
                }
                else {
                    app.config = {};
                }
            }
            callback(null)
        });
        
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
    logger.info("action=save_room_definition room=" + this.roomGuid);
    this.redis.hset('roomDefinition', this.roomGuid, JSON.stringify({
        name: this.name,
        guid: this.roomGuid,
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

RoomDefinition.prototype.updateAppConfig = function(appInstanceGuid, configData) {
    for (var i=0,len=this.apps.length; i < len; i++) {
        var app = this.apps[i];
        if (app.guid === appInstanceGuid) {
            logger.info("action=update_app_config app_instance_guid=" + appInstanceGuid + " Saving updated app config data");
            app.config = configData;
            this.redis.hset('app_config', appInstanceGuid, JSON.stringify(configData));
            return;
        }
    }
};

RoomDefinition.prototype.getSerializableHash = function() {
    return {
        name: this.name,
        guid: this.roomGuid,
        locked: this.room && this.room.locked,
        owner_guid: this.ownerGuid,
        world_guid: this.worldGuid,
        background: this.background,
        hotspots: this.hotspots,
        objects: this.objects,
        youtube_players: this.youtubePlayers,
        properties: this.properties
    };
};

module.exports = RoomDefinition;