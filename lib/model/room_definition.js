var Log = require('../util/log'),
    events = require('events'),
    util = require('util'),
    config = require('../config'),
    Hotspot = require('./room_definition/hotspot'),
    YouTubePlayer = require('./room_definition/youtube_player'),
    InWorldObjectInstance = require('./room_definition/in_world_object_instance'),
    AppInstance = require('./room_definition/app_instance'),
    MessageEncoder = require('../rpc/message_encoder'),
    redisConnectionManager = require('./redis_connection_manager'),
    pubsubManager = require('./pubsub_manager'),
    uuid = require('node-uuid'),
    async = require('async'),
    _ = require('underscore');

var sequelize = require('./sequelize_models');
var s3ObjectsBucket = config['amazonConfig']['in_world_objects_bucket'];
var s3AppsBucket = config['amazonConfig']['swf_api_bucket'];
var s3BackgroundsBucket = config['amazonConfig']['backgrounds_bucket'];
var logger = Log.getLogger('model.RoomDefinition');
var guidRegexp = /^[\da-fA-F]{8}-[\da-fA-F]{4}-[\da-fA-F]{4}-[\da-fA-F]{4}-[\da-fA-F]{12}$/;

RoomDefinition = function(roomGuid) {
    events.EventEmitter.call(this);
    this.redis = redisConnectionManager.getClient('room_definitions');
    this.rawData = null;
    this.schemaVersion = RoomDefinition.migrations.length + 1;
    this.schemaStartVersion = this.schemaVersion;
    
    this.roomGuid = roomGuid;
    this.room = null;
    this.name = "Untitled Room";
    this.ownerGuid = null;
    this.worldGuid = null;
    this.background = config.defaultRoomBackgroundURL;
    this.properties = {};
    this.items = [];
};

// migration files are named after the destination schema version
RoomDefinition.migrations = [
    require('../migrations/room_definition/v2'),
    require('../migrations/room_definition/v3')
];

RoomDefinition.destroy = function(roomGuid, callback) {
    var self = this;
    this.load(roomGuid, function(err, roomDefinition) {
        if (err) {
            callback(err);
            return;
        }

        roomDefinition.items.forEach(function(item) {
            if (item.type === 'app' || item.type === 'object') {
                roomDefinition.removeItem(item.guid, true);
            }
        });
        
        var redis = redisConnectionManager.getClient('room_definitions');
        var multi = redis.multi();
        multi.hdel('roomDefinition', roomGuid);
        multi.hdel('hotspots', roomGuid);
        multi.hdel('embedded_youtube_players', roomGuid);
        multi.hdel('in_world_objects', roomGuid);
        multi.exec(function(err, results) {
            if (err) {
                callback(err);
                return;
            }
            if (results[0]) {
                callback(null);
                return;
            }
            callback("Room definition for guid " + roomGuid + " does not exist.");
        });
    });
};

RoomDefinition.load = function(roomGuid, callback) {
    roomGuid = roomGuid.toLowerCase();
    var definition = new RoomDefinition();
    definition.roomGuid = roomGuid;
    definition.load(function(err) {
        if (err) {
            callback(err);
            return;
        }
        
        // If we migrated forward, lets save the updated version back to
        // the database in the background.
        if (definition.schemaVersion !== definition.schemaStartVersion) {
            // console.log("Migrated to new schema version:\n" + util.inspect(definition.rawData, false, null))
            definition.save(function(err) {
                if (err) {
                    logger.error("There was an error while saving the migrated " +
                                 "room definition: " + err.toString());
                    return;
                }
                logger.info("Successfully saved migrated room definition to the database.");
            });
        }
        
        // We're done!
        callback(null, definition);
    });
};

RoomDefinition.prototype.cloneTo = function(dest, roomGuidMap, itemGuidMap, callback) {
    if (!dest || !_.isObject(roomGuidMap) || !_.isObject(itemGuidMap)) {
        callback(new Error("Incorrect parameters for cloneTo()"));
        return;
    }
    
    var self = this;
    
    // Clone room properties
    dest.properties = {};
    for (var key in this.properties) {
        dest.properties[key] = this.properties[key];
    }
    
    // Clone background filename
    dest.background = this.background;
    
    // Clone room items, making sure to correctly update the dest guids to
    // point to the correct rooms, and the instance guids to point to the
    // correct new object instances.  The mapping information is provided
    // in two Objects, roomGuidMap and itemGuidMap.
    this.items.forEach(function(sourceItem) {
        if (sourceItem.type === 'app') {
            // TODO: Implement cloning functionality for apps
            return;
        }
        
        if (typeof(sourceItem.clone) === 'function') {
            var newItem = sourceItem.clone();
            if (itemGuidMap[sourceItem.guid]) {
                newItem.guid = itemGuidMap[sourceItem.guid];
            }
            else {
                newItem.guid = uuid.v1();
            }

            if (sourceItem.hasOwnProperty('dest') && roomGuidMap[sourceItem.dest]) {
                newItem.dest = roomGuidMap[sourceItem.dest];
            }

            dest.items.push(newItem);
        }
    });
    
    dest.save(callback);
};

RoomDefinition.prototype.updateAttributes = function(attributes, callback) {
    var self = this;
    var propertyChanges = {};
    var changes = {};
    
    var attrNames = ['name','worldGuid','ownerGuid'];
    
    attrNames.forEach(function(attrName) {
        if (attributes.hasOwnProperty(attrName)) {
            var oldValue = self[attrName];
            var newValue = attributes[attrName];
            if (oldValue !== newValue) {
                self[attrName] = newValue;
                changes[attrName] = [oldValue, newValue];
            }
        }
    });
    
    if (attributes.hasOwnProperty('properties')) {
        for (var key in attributes.properties) {
            var oldValue = this.properties[key];
            var newValue = attributes.properties[key];
            if (oldValue !== newValue) {
                this.properties[key] = newValue;
                propertyChanges[key] = [oldValue, newValue];
            }
        }
    }
    
    var propertiesChanged = Object.keys(propertyChanges);
    var attributesChanged = Object.keys(changes);
    
    if (propertiesChanged.length > 0 || attributesChanged.length > 0) {
        this.save(callback);
    }
    else {
        process.nextTick(callback.bind(global, null));
    }

    if (attributesChanged.length > 0) {
        pubsubManager.publish(
            'room:' + this.roomGuid,
            MessageEncoder.encode({
                msg: 'room_definition_updated',
                data: {
                    guid: this.roomGuid,
                    changes: changes
                }
            })
        );
    }
    
    if (propertiesChanged.length > 0) {
        propertiesChanged.forEach(function(key) {
            pubsubManager.publish(
                'room:' + self.roomGuid,
                MessageEncoder.encode({
                    msg: 'update_room_property',
                    data: {
                        name: key,
                        value: propertyChanges[key][1]
                    }
                })
            );
        });
    }
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
    
    this.redis.hget('roomDefinition', this.roomGuid, function(err, result) {
        if (err) {
            logger.error("Redis error loading room definition for room " + self.roomGuid + ": " + err.toString());
            callback(err);
            return;
        }
        
        // Make sure we have result data
        if (result === null) {
            logger.warn("Room " + self.roomGuid + " does not exist.");
            callback("Room " + self.roomGuid + " does not exist.");
            return;
        }
        
        // Parse the JSON data loaded from the DB
        try {
            self.rawData = JSON.parse(result);
        }
        catch(e) {
            logger.error("JSON Parsing error while loading room definition: " + e.toString());
            callback("JSON Parsing Error: " + e.toString());
            return;
        }
        
        // Read the initial schema version from the data
        if (self.rawData.hasOwnProperty('_sv_')) {
            self.schemaVersion = self.rawData['_sv_'];
        }
        else {
            self.schemaVersion = 1;
        }

        // apply any data migrations that may be needed
        self.migrate(function(err) {
            if (err) {
                callback(err);
                return;
            }
            
            // Initialize the model's properties from the raw data
            self.parseRawData();
            
            // Load the configuration for any apps that may be in the room
            self.loadAppConfigs(callback);
        });
    });
};
    

RoomDefinition.prototype.migrate = function(callback) {
    var self = this;
    
    var latestVersion = RoomDefinition.migrations.length + 1;
    var startVersion = self.schemaStartVersion = self.schemaVersion;
    var currentVersion = startVersion;
    
    function doMigration() {
        // If we've reached the latest version, we're done
        if (currentVersion === latestVersion) {
            callback(null);
            return;
        }
        
        // Find the appropriate migration function
        var migrationFunction = RoomDefinition.migrations[currentVersion-1];
        
        logger.info("Migrating room definition room=" + self.roomGuid + " " +
                    "oldversion=" + currentVersion + " newversion=" + (currentVersion+1));
        migrationFunction.call(self, self.rawData, function(err) {
            if (err) {
                callback(err);
                return;
            }
            currentVersion ++;
            self.rawData['_sv_'] = self.schemaVersion = currentVersion;
            doMigration();
        });
    }
    
    // Start migrating
    doMigration();
};

// This function only has to support the latest schema version because
// the raw data will already have been migrated by the migration functions.
RoomDefinition.prototype.parseRawData = function() {
    this.name = this.rawData.name;
    this.worldGuid = this.rawData.worldGuid;
    this.ownerGuid = this.rawData.ownerGuid;
    this.background = this.rawData.background;
    this.properties = this.rawData.properties || {};
    var items = this.rawData.items || [];
    this.items = items.map(function(item) {
        if (item.type === 'hotspot') {
            return new Hotspot(item);
        }
        if (item.type === 'object') {
            return new InWorldObjectInstance(item);
        }
        if (item.type === 'app') {
            return new AppInstance(item);
        }
        if (item.type === 'youtubePlayer') {
            return new YouTubePlayer(item);
        }
        return item;
    });
};

RoomDefinition.prototype.getItemByGuid = function(guid) {
    for (var i=0; i < this.items.length; i++) {
        var item = this.items[i];
        if (item.guid === guid) {
            return item;
        }
    }
    return null;
};

RoomDefinition.prototype.removeItem = function(guid, broadcastUpdate) {
    for (var i=0; i < this.items.length; i++) {
        var item = this.items[i];
        if (item.guid === guid) {
            var result = this.items.splice(i, 1)[0];
            if (broadcastUpdate) {
                pubsubManager.publish(
                    'room:' + this.roomGuid,
                    MessageEncoder.encode({
                        msg: 'remove_item',
                        data: {
                            room: this.roomGuid,
                            guid: item.guid
                        }
                    })
                );
            }
            return result;
        }
    }
    return null;
};

RoomDefinition.prototype.loadAppConfigs = function(callback) {
    var apps = this.items.filter(function(item) {
        return item.type === 'app';
    });

    // If there are no 'app' objects, we're done
    if (apps.length === 0) {
        callback(null);
        return;
    }

    // If there are, we have to load in their configs
    var multi = this.redis.multi();
    apps.forEach(function(app) {
        multi.hget('app_config', app.guid);
    });
    logger.debug("Loading config data for " + apps.length + " apps. room=" + this.roomGuid);
    multi.exec(function(err, replies) {
        if (err) {
            logger.error("Redis error loading app configs for room " + self.roomGuid + ": " + err.toString());
            callback(err);
            return;
        }
        for (var i=0,len=replies.length; i < len; i++) {
            var app = apps[i];
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
    if (typeof(callback) !== 'function') { callback = function(){}; }
    logger.info("action=save_room_definition room=" + this.roomGuid);
    
    this.redis.hset('roomDefinition', this.roomGuid, JSON.stringify(this), function(err, result) {
        if (err) {
            callback("Unable to save room definition: " + err);
            logger.error("Unable to save room definition: " + err);
            return;
        }
        callback(null);
    });
};

RoomDefinition.prototype.updateAppConfig = function(appInstanceGuid, configData) {
    for (var i=0,len=this.items.length; i < len; i++) {
        var item = this.items[i];
        if (item.type !== 'app') { continue; }
        if (item.guid === appInstanceGuid) {
            logger.info("action=update_app_config app_instance_guid=" + appInstanceGuid + " Saving updated app config data");
            item.config = configData;
            this.redis.hset('app_config', appInstanceGuid, JSON.stringify(configData));
            return;
        }
    }
};

RoomDefinition.prototype.addObjectInstance = function(objectInstanceGuid, x, y, dest, user, callback) {
    var self = this;
    var objectInstanceModel;
    var objectModel;
    var roomModel;
    var userModel;
    
    if (typeof(objectInstanceGuid) !== 'string' || !objectInstanceGuid.match(guidRegexp)) {
        callback(new Error("The object instance guid must be a valid guid."));
        return;
    }
    
    function loadObjectInstanceModel() {
        sequelize.InWorldObjectInstance.find({
            where: {
                guid: objectInstanceGuid,
                room_id: null
            }
        })
        .success(function(model) {
            if (model === null) {
                callback(new Error("Unable to find the specified object instance.  Perhaps it's already in use?"));
                return;
            }
            objectInstanceModel = model;
            loadUserModel();
        })
        .error(function(error) {
            callback(error);
        });
    }
    
    function loadUserModel() {
        sequelize.User.find(objectInstanceModel.user_id)
        .success(function(model) {
            if (model === null) {
                callback(new Error("Unable to find the object instance owner."));
                return;
            }
            if (model.guid !== user.guid) {
                callback(new Error("The current user does not own the specified object instance."));
                return;
            }
            userModel = model;
            loadObjectModel();
        })
        .error(function(error) {
            callback(error);
        });
    }
    
    function loadObjectModel() {
        sequelize.InWorldObject.find(objectInstanceModel.in_world_object_id)
        .success(function(model) {
            if (model === null) {
                callback(new Error("Unable to find the object in the MySQL database."));
                return;
            }
            objectModel = model;
            loadRoomModel();
        })
        .error(function(error) {
            callback(error);
        });
    }
    
    function loadRoomModel() {
        sequelize.Room.find({
            where: {
                guid: self.roomGuid
            }
        })
        .success(function(model) {
            if (model === null) {
                callback(new Error("Unable to find the room in the MySQL database."));
                return;
            }
            roomModel = model;
            finish();
        })
        .error(function(error) {
            callback(error);
        });
    }
    
    function finish() {
        var inWorldObjectInstance = new InWorldObjectInstance({
            guid: objectInstanceModel.guid,
            x: x,
            y: y,
            dest: dest,
            creator: userModel.guid,
            fullsize_url: "https://s3.amazonaws.com/" + s3ObjectsBucket + "/" + objectModel.guid + "/" + objectModel.image,
            thumbnail_url: "https://s3.amazonaws.com/" + s3ObjectsBucket + "/" + objectModel.guid + "/thumb_" + objectModel.image,
            object_guid: objectModel.guid
        });
        
        self.items.push(inWorldObjectInstance);
        
        self.save(function(err) {
            if (err) {
                callback(err);
                return;
            }
            
            objectInstanceModel.updateAttributes({
                room_id: roomModel.id
            })
            .success(function() {
                callback(null, inWorldObjectInstance);
            })
            .error(function(error) {
                callback(error);
            })
        });
    }
    
    loadObjectInstanceModel();
};

RoomDefinition.prototype.removeObjectInstance = function(objectInstanceGuid, broadcastUpdate, callback) {
    if (typeof(broadcastUpdate) === 'function') {
        callback = broadcastUpdate;
        broadcastUpdate = false;
    }
    
    var self = this;

    var item = this.getItemByGuid(objectInstanceGuid);
    if (!item) {
        callback(new Error("The specified object guid is not in this room."));
        return;
    }
    if (item.type !== 'object') {
        callback(new Error("The specified guid is not an object."));
        return;
    }
    
    this.removeItem(objectInstanceGuid, broadcastUpdate);
    this.save(function(err) {
        if (err) {
            callback(new Error("Unable to save room definition: " + err.toString()));
            return;
        }
        unlinkObjectInstance();
    });
    
    function unlinkObjectInstance() {
        sequelize.InWorldObjectInstance.find({
            where: {
                guid: objectInstanceGuid
            }
        })
        .success(function(model) {
            if (model === null) {
                // If we can't find the model in the MySQL database, we should
                // remove it from the room anyway, so this isn't really an error
                // condition.
                callback(null, item);
                return;
            }
            model.updateAttributes({
                room_id: null
            })
            .success(function() {
                callback(null, item);
            })
            .error(function(error) {
                callback(error);
            })
        })
        .error(function(error) {
            callback(error);
        });
    }
};

RoomDefinition.prototype.addAppInstance = function(appInstanceGuid, x, y, dest, user, callback) {
    var self = this;
    var appInstanceModel;
    var appModel;
    var roomModel;
    var userModel;
    
    if (typeof(appInstanceGuid) !== 'string' || !appInstanceGuid.match(guidRegexp)) {
        callback(new Error("The app instance guid must be a valid guid."));
        return;
    }
    
    function loadAppInstanceModel() {
        sequelize.AppInstance.find({
            where: {
                guid: appInstanceGuid,
                room_id: null
            }
        })
        .success(function(model) {
            if (model === null) {
                callback(new Error("Unable to find the specified app instance.  Perhaps it's already in use?"));
                return;
            }
            appInstanceModel = model;
            loadUserModel();
        })
        .error(function(error) {
            callback(error);
        });
    }
    
    function loadUserModel() {
        sequelize.User.find(appInstanceModel.user_id)
        .success(function(model) {
            if (model === null) {
                callback(new Error("Unable to find the object instance owner."));
                return;
            }
            if (model.guid !== user.guid) {
                callback(new Error("The current user does not own the specified object instance."));
                return;
            }
            userModel = model;
            loadAppModel();
        })
        .error(function(error) {
            callback(error);
        });
    }
    
    function loadAppModel() {
        sequelize.App.find(appInstanceModel.app_id)
        .success(function(model) {
            if (model === null) {
                callback(new Error("Unable to find the app in the MySQL database."));
                return;
            }
            appModel = model;
            loadRoomModel();
        })
        .error(function(error) {
            callback(error);
        });
    }
    
    function loadRoomModel() {
        sequelize.Room.find({
            where: {
                guid: self.roomGuid
            }
        })
        .success(function(model) {
            if (model === null) {
                callback(new Error("Unable to find the room in the MySQL database."));
                return;
            }
            roomModel = model;
            finish();
        })
        .error(function(error) {
            callback(error);
        });
    }
    
    function finish() {
        var appData = {
            guid: appInstanceModel.guid,
            x: x,
            y: y,
            width: appModel.width,
            height: appModel.height,
            dest: dest,
            creator: userModel.guid,
            app_url: "https://s3.amazonaws.com/" + s3AppsBucket + "/" + appModel.guid + "/app.swf",
            app_guid: appModel.guid,
            app_name: appModel.name,
            config: {}
        };
        
        if (appModel.icon) {
            appData['icon'] = "https://s3.amazonaws.com/" + s3AppsBucket + "/" + appModel.guid + "/" + appModel.icon;
            appData['small_icon'] = "https://s3.amazonaws.com/" + s3AppsBucket + "/" + appModel.guid + "/small_" + appModel.icon;
            appData['medium_icon'] = "https://s3.amazonaws.com/" + s3AppsBucket + "/" + appModel.guid + "/medium_" + appModel.icon;
        }
        
        var appInstance = new AppInstance(appData);
        
        self.items.push(appInstance);
        
        if (self.room) {
            self.room.initializeAppData(appInstanceModel.guid);
        }
        
        self.save(function(err) {
            if (err) {
                callback(err);
                return;
            }
            
            appInstanceModel.updateAttributes({
                room_id: roomModel.id
            })
            .success(function() {
                callback(null, appInstance);
            })
            .error(function(error) {
                callback(error);
            })
        });
    }
    
    loadAppInstanceModel();
};

RoomDefinition.prototype.removeAppInstance = function(appInstanceGuid, broadcastUpdate, callback) {
    if (typeof(broadcastUpdate) === 'function') {
        callback = broadcastUpdate;
        broadcastUpdate = false;
    }
    
    var self = this;

    var item = this.getItemByGuid(appInstanceGuid);
    if (!item) {
        callback(new Error("The specified app guid is not in this room."));
        return;
    }
    if (item.type !== 'app') {
        callback(new Error("The specified guid is not an app."));
        return;
    }
    
    this.removeItem(appInstanceGuid, broadcastUpdate);
    this.save(function(err) {
        if (err) {
            callback(new Error("Unable to save room definition: " + err.toString()));
            return;
        }
        unlinkAppInstance();
    });
    
    function unlinkAppInstance() {
        sequelize.AppInstance.find({
            where: {
                guid: appInstanceGuid
            }
        })
        .success(function(model) {
            if (model === null) {
                // If we can't find the model in the MySQL database, we should
                // remove it from the room anyway, so this isn't really an error
                // condition.
                callback(null, item);
                return;
            }
            model.updateAttributes({
                room_id: null
            })
            .success(function() {
                callback(null, item);
            })
            .error(function(error) {
                callback(error);
            })
        })
        .error(function(error) {
            callback(error);
        });
    }
};

RoomDefinition.prototype.setBackgroundInstance = function(instanceGuid, user, callback) {
    var self = this;
    
    var existingBackgroundInstanceModel;
    var newBackgroundInstanceModel;
    var newBackgroundModel;
    var roomModel;
    var userModel;
    
    begin();
    
    function begin() {
        loadRoomModel();
    }
    
    function loadRoomModel() {
        sequelize.Room.find({
            where: {
                guid: self.roomGuid
            }
        })
        .success(function(model) {
            if (model === null) {
                callback(new Error("Unable to find the room in the MySQL database."));
                return;
            }
            roomModel = model;
            loadExistingBackgroundInstanceModel();
        })
        .error(function(error) {
            callback(error);
        });
    }
    
    function loadExistingBackgroundInstanceModel() {
        sequelize.BackgroundInstance.find({
            where: {
                room_id: roomModel.id
            }
        })
        .success(function(model) {
            existingBackgroundInstanceModel = model;
            loadNewBackgroundInstanceModel();
        })
        .error(function(error) {
            callback(error);
        });
    }

    function loadNewBackgroundInstanceModel() {
        sequelize.BackgroundInstance.find({
            where: {
                guid: instanceGuid
            }
        })
        .success(function(model) {
            if (model === null) {
                callback(new Error('Unable to find the specified background instance in MySQL.'));
                return;
            }
            newBackgroundInstanceModel = model;
            loadNewBackgroundModel();
        })
        .error(function(error) {
            callback(error);
        });
    }
    
    function loadNewBackgroundModel() {
        sequelize.Background.find(newBackgroundInstanceModel.background_id)
        .success(function(model) {
            if (model === null) {
                callback(new Error("Unable to find background for the given background instance."));
                return;
            }
            newBackgroundModel = model;
            if (existingBackgroundInstanceModel) {
                unlinkExistingBackgroundInstanceModel();
            }
            else {
                linkNewBackgroundInstanceModel();
            }
        })
        .error(function(error) {
            callback(error);
        });
    }
    
    function unlinkExistingBackgroundInstanceModel() {
        existingBackgroundInstanceModel.updateAttributes({
            room_id: null
        })
        .success(function() {
            linkNewBackgroundInstanceModel();
        })
        .error(function(error) {
            callback(error);
        });
    }
    
    function linkNewBackgroundInstanceModel() {
        newBackgroundInstanceModel.updateAttributes({
            room_id: roomModel.id
        })
        .success(function() {
            updateRoomDefinition();
        })
        .error(function(error) {
            callback(error);
        });
    }
    
    function updateRoomDefinition() {
        var backgroundURL = "https://s3.amazonaws.com/" + s3BackgroundsBucket + "/" +
                            newBackgroundModel.guid + "/" + newBackgroundModel.image;
        self.background = backgroundURL;
        self.save(function(err) {
            if (err) {
                callback(err);
                return;
            }
            callback(null, backgroundURL, newBackgroundInstanceModel, existingBackgroundInstanceModel);
        });
    }
};

RoomDefinition.prototype.toJSON = function() {
    return {
        _sv_: this.schemaVersion,
        name: this.name,
        guid: this.roomGuid,
        worldGuid: this.worldGuid,
        ownerGuid: this.ownerGuid,
        background: this.background,
        properties: this.properties,
        items: this.items.map(function(item) {
            if ('toSavableData' in item) {
                return item.toSavableData();
            }
            return item;
        })
    };
};

RoomDefinition.prototype.getSerializableHash = function() {
    return {
        name: this.name,
        guid: this.roomGuid,
        locked: this.room && this.room.locked,
        owner_guid: this.ownerGuid,
        world_guid: this.worldGuid,
        background: this.background,
        items: this.items,
        properties: this.properties
    };
};

module.exports = RoomDefinition;