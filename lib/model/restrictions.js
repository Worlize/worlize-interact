var util = require('util'),
    events = require('events'),
    RedisConnectionManager = require("./redis_connection_manager"),
    Restriction = require('./restriction'),
    async = require('async'),
    Log = require('../util/log');
    
var logger = Log.getLogger("model.Restrictions");

function Restrictions() {
    events.EventEmitter.call(this);
    this.userGuid = null;
    this.worldGuid = null;
    this.restrictions = [];
    this.restrictionMap = {};
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
    
    var self = this;
    loadMergedRestrictions(userGuid, worldGuid, function(err, result) {
        self.restrictions = result.restrictions;
        self.restrictionMap = result.restrictionMap;
        self.worldGuid = worldGuid;
        self.userGuid = userGuid;
        
        self.ready = true;
        
        if (self.restrictions.length === 0) {
            self.clearRefreshTimer();
        }
        else {
            self.setRefreshTimer();
        }
        
        logger.debug2("Restrictions loaded user=" + userGuid + " world=" + worldGuid);
        self.emit('changed');
        callback(null, self);
    });
};

Restrictions.prototype.setRefreshTimer = function() {
    this.clearRefreshTimer();

    var refreshSeconds = Math.min.apply(null,
        this.restrictions
        .filter(function(restriction) { return restriction.active(); })
        .map(function(restriction) { return restriction.remainingSeconds(); })
    );
    
    if (refreshSeconds === Infinity || refreshSeconds === -Infinity) {
        // no active restrictions
        return;
    }
    
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
    var restriction = this.restrictionMap[name];
    return restriction ? restriction.active() : false;
};

Restrictions.prototype.toJSON = function() {
    return this.restrictions;
};

function loadMergedRestrictions(userGuid, worldGuid, callback) {
    async.concat(
        [
            "w:" + worldGuid + ":" + userGuid,
            "g:" + userGuid
        ],
        getRedisRestrictions,
        function(err, results) {
            if (err) {
                callback(err);
                return;
            }
            callback(null, reduceRestrictions(results));
        }
    );
}

function getRedisRestrictions(redisKey, callback) {
    var redis = RedisConnectionManager.getClient("restrictions");
    redis.get(redisKey, function(err, result) {
        if (err) {
            callback("Unable to load user restrictions: " + err);
            return;
        }
        
        if (result === null) {
            // No restrictions in effect.
            logger.debug3("No restrictions at key " + redisKey);
            callback(null, []);
            return;
        }
        
        try {
            result = JSON.parse(result);
        }
        catch(e) {
            callback("Unable to load user restrictions: " + e);
        }
        
        logger.debug3("Restrictions at redis key " + redisKey + ":\n" + util.inspect(result));
        
        callback(null, result.map(function(restrictionData) {
            return Restriction.fromJSON(restrictionData);
        }));
    });
}

function reduceRestrictions(rawRestrictions) {
    var restrictions = [];
    var restrictionMap = {};
    var now = new Date();
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
        restrictions.push(restriction);
        restrictionMap[restriction.name] = restriction;
    });
    
    return {
        restrictions: restrictions,
        restrictionMap: restrictionMap
    };
}

module.exports = Restrictions;