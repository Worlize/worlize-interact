var util = require('util'),
    events = require('events'),
    RedisConnectionManager = require("./redis_connection_manager"),
    Restriction = require('./restriction'),
    async = require('async'),
    Log = require('../util/log'),
    _ = require('underscore');
    
var logger = Log.getLogger("model.Restrictions");

var bitmapLookup = {
    "gag": 0x01,
    "pin": 0x02,
    "ban": 0x04,
    "block_avatars": 0x08,
    "block_webcams": 0x10,
    "block_props": 0x20
};

function Restrictions() {
    events.EventEmitter.call(this);
    this.userGuid = null;
    this.worldGuid = null;
    this.worldRestrictions = {};
    this.globalRestrictions = {};
    this.worldBitmap = 0;
    this.globalBitmap = 0;
    this.bitmap = 0;
    this.ready = false;
}

util.inherits(Restrictions, events.EventEmitter);

Restrictions.load = function(userGuid, worldGuid, callback) {
    (new Restrictions()).load(userGuid, worldGuid, callback);
};

Restrictions.prototype.reload = function(callback) {
    if (!this.ready) { return; }
    this.load(this.userGuid, this.worldGuid, callback);
};

Restrictions.prototype.load = function(userGuid, worldGuid, callback) {
    if (userGuid === null) { throw new Error("You must specify a user guid"); }
    if (worldGuid === null) { throw new Error("You must specify a world guid"); }
    if (typeof(callback) !== 'function') { callback = function(){}; }
    
    logger.debug2("Loading restrictions for user=" + userGuid + " world=" + worldGuid);
    
    this.userGuid = userGuid;
    this.worldGuid = worldGuid;
    
    var self = this;
    
    var redis = RedisConnectionManager.getClient("restrictions");
    var multi = redis.multi();
    multi.get("w:" + worldGuid + ":" + userGuid);
    multi.get("g:" + userGuid);
    multi.exec(function(err, replies) {
        var worldRestrictionsData;
        var globalRestrictionsData;
        try {
            worldRestrictionsData = JSON.parse(replies[0]) || [];
        }
        catch(e) {
            worldRestrictionsData = [];
        }
        try {
            globalRestrictionsData = JSON.parse(replies[1]) || [];
        }
        catch(e) {
            globalRestrictionsData = [];
        }
        
        self.worldRestrictions = reduceRestrictions(
            worldRestrictionsData.map(function(restrictionData) {
                return Restriction.fromJSON(restrictionData);
            })
        );
        self.globalRestrictions = reduceRestrictions(
            globalRestrictionsData.map(function(restrictionData) {
                return Restriction.fromJSON(restrictionData);
            })
        );
        
        self.worldBitmap = self.worldRestrictions.bitmap;
        self.globalBitmap = self.globalRestrictions.bitmap;
        self.bitmap = self.worldBitmap | self.globalBitmap;
        
        if (self.worldRestrictions.list.length === 0 &&
            self.globalRestrictions.list.length === 0)
        {
            self.clearRefreshTimer();
        }
        else {
            self.setRefreshTimer();
        }
        
        logger.debug2("Restrictions loaded user=" + userGuid + " world=" + worldGuid);
        self.ready = true;
        self.emit('changed');
        callback(null, self);
    });
};

Restrictions.prototype.setRefreshTimer = function() {
    this.clearRefreshTimer();

    var refreshSeconds = Math.min.apply(null,
        this.worldRestrictions.list.concat(this.globalRestrictions.list)
        .filter(function(restriction) { return restriction.active(); })
        .map(function(restriction) { return restriction.remainingSeconds(); })
    );
    
    if (refreshSeconds === Infinity || refreshSeconds === -Infinity) {
        // no active restrictions
        return;
    }
    
    refreshSeconds = Math.min(refreshSeconds, 3600);
    
    logger.debug3("Setting refresh timer to " + refreshSeconds*1000+1000 + " milliseconds");
    
    this.refreshTimeout = setTimeout(this.reload.bind(this), refreshSeconds*1000+1000);
};

Restrictions.prototype.clearRefreshTimer = function() {
    if (this.refreshTimeout) {
        clearTimeout(this.refreshTimeout);
        this.refreshTimeout = null;
    }
};

Restrictions.prototype.hasActiveRestriction = function(name) {
    if (!this.ready) { throw new Error("Unable to check whether restriction is active: not yet ready."); }
    return (this.bitmap & bitmapLookup[name]) === bitmapLookup[name];
};

Restrictions.prototype.hasActiveWorldRestriction = function(name) {
    if (!this.ready) { throw new Error("Unable to check whether restriction is active: not yet ready."); }
    return (this.worldBitmap & bitmapLookup[name]) === bitmapLookup[name];
};

Restrictions.prototype.hasActiveGlobalRestriction = function(name) {
    if (!this.ready) { throw new Error("Unable to check whether restriction is active: not yet ready."); }
    return (this.globalBitmap & bitmapLookup[name]) === bitmapLookup[name];
};

Restrictions.prototype.toJSON = function() {
    return {
        world: this.worldRestrictions.list,
        global: this.globalRestrictions.list
    };
};

function reduceRestrictions(rawRestrictions) {
    var restrictions = [];
    var restrictionMap = {};
    var now = new Date();
    var bitmap = 0;
    rawRestrictions.forEach(function(restriction) {
        if (restriction.expires < now) { return; }
        var existingRestriction = restrictionMap[restriction.name];
        if (existingRestriction) {
            if (existingRestriction.expires > restriction.expires) {
                return;
            }
            else {
                restrictions.splice(restrictions.indexOf(existingRestriction), 1);
            }
        }
        if (restriction.active()) {
            bitmap |= bitmapLookup[restriction.name];
        }
        restrictions.push(restriction);
        restrictionMap[restriction.name] = restriction;
    });
    
    return {
        list: restrictions,
        map: restrictionMap,
        bitmap: bitmap
    };
}

module.exports = Restrictions;