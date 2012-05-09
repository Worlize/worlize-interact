var Log = require('../../util/log');
var logger = Log.getLogger('model.migrations.room_definition.v2');

// 'this' will be the RoomDefinition model object
module.exports = function(rawData, callback) {
    var self = this;
    var items = rawData.items = [];
    
    // Convert underscore notation to lowerCamelCase
    rawData.worldGuid = rawData['world_guid'];
    delete rawData['world_guid'];
    rawData.ownerGuid = rawData['owner_guid'];
    delete rawData['owner_guid'];
    rawData.properties = rawData.properties || {};
    
    // Load additional data that used to be stored in various other redis keys
    var multi = this.redis.multi();
    multi.hget('hotspots', this.roomGuid);
    multi.hget('embedded_youtube_players', this.roomGuid);
    multi.hget('in_world_objects', this.roomGuid);
    multi.exec(function(err, replies) {
        if (err) {
            logger.error("Redis error loading room definition for room=" + self.roomGuid + ": " + err.toString());
            callback(err);
            return;
        }
        var hotspots = replies[0];
        var embeddedYoutubePlayers = replies[1];
        var inWorldObjects = replies[2];
    
        try {
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
            logger.error("room=" + self.roomGuid + " JSON Parsing error loading room definition (v1): " + e.toString());
            callback("JSON Parsing Error: " + e.toString());
            return;
        }

        hotspots = Array.isArray(hotspots) ? hotspots : [];
        objects = Array.isArray(inWorldObjects) ? inWorldObjects : [];
        youtubePlayers = Array.isArray(embeddedYoutubePlayers) ? embeddedYoutubePlayers : [];
        
        objects.forEach(function(item) {
            if (item.kind === 'app') {
                item.type = 'app'
            }
            else {
                item.type = 'object';
            }
            delete item['kind'];
            
            if (typeof(item.x) !== 'number') {
                item.x = parseInt(item.x, 10);
            }
            if (typeof(item.y) !== 'number') {
                item.y = parseInt(item.y, 10);
            }
            
            items.push(item);
        });
        
        youtubePlayers.forEach(function(item) {
            item.type = "youtubePlayer";
            
            if (typeof(item.x) !== 'number') {
                item.x = parseInt(item.x, 10);
            }
            if (typeof(item.y) !== 'number') {
                item.y = parseInt(item.y, 10);
            }
            if (typeof(item.width) !== 'number') {
                item.width = parseInt(item.width, 10);
            }
            if (typeof(item.height) !== 'number') {
                item.height = parseInt(item.height, 10);
            }

            items.push(item);
        });
        
        hotspots.forEach(function(item) {
            item.type = "hotspot";
            items.push(item);
        });
        
        deleteOldRedisData(self.roomGuid, self.redis, function(err, replies) {
            if (err) {
                logger.error("Unable to delete old redis data: " + err.toString());
                return;
            }
            logger.info("Deleted old format redis room definition data for room=" + self.roomGuid);
        });
        
        callback(null);
    });
};

function deleteOldRedisData(roomGuid, redis, callback) {
    var multi = redis.multi();
    multi.hdel('hotspots', roomGuid);
    multi.hdel('embedded_youtube_players', roomGuid);
    multi.hdel('in_world_objects', roomGuid);
    multi.exec(callback);
}