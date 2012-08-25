var util = require('util'),
    events = require('events'),
    RedisConnectionManager = require("./redis_connection_manager"),
    PermissionsLookup = require('./lookup/permissions_lookup'),
    async = require('async'),
    Log = require('../util/log'),
    _ = require('underscore');
    
var logger = Log.getLogger("model.Permissions");

function Permissions() {
    events.EventEmitter.call(this);
    this.userGuid = null;
    this.worldGuid = null;
    this.isWorldOwner = false;
    this.worldPermissions = [];
    this.globalPermissions = [];
    this.appliedPermissions = [];
    this.ready = false;
}

util.inherits(Permissions, events.EventEmitter);

Permissions.prototype.reload = function(callback) {
    if (!this.ready) { return; }
    this.load(this.userGuid, this.worldGuid, this.isWorldOwner, callback);
};

Permissions.prototype.load = function(userGuid, worldGuid, isWorldOwner, callback) {
    if (userGuid === null) { throw new Error("You must specify a user guid"); }
    if (worldGuid === null) { throw new Error("You must specify a world guid"); }
    if (typeof(callback) !== 'function') { callback = function(){}; }
    
    logger.debug2("Loading permissions for user=" + userGuid + " world=" + worldGuid);
    
    var self = this;
    
    var redis = RedisConnectionManager.getClient("permissions");
    var multi = redis.multi();
    multi.smembers("w:" + worldGuid + ":" + userGuid);
    multi.smembers("g:" + userGuid);
    multi.sunion(
        "w:" + worldGuid + ":" + userGuid,
        "g:" + userGuid
    );
    multi.exec(function(err, replies) {
        self.userGuid = userGuid;
        self.worldGuid = worldGuid;
        self.isWorldOwner = isWorldOwner;
        
        self.worldPermissions = replies[0];
        self.globalPermissions = replies[1];
        self.appliedPermissions = replies[2];
        
        // Make sure owners are always granted owner permissions
        if (self.isWorldOwner) {
            self.worldPermissions = _.union(
                self.worldPermissions,
                PermissionsLookup.ownerDefault.ids
            );
            self.appliedPermissions = _.union(
                self.appliedPermissions,
                PermissionsLookup.ownerDefault.ids
            );
        }
        
        logger.debug2("Permissions loaded user=" + userGuid + " world=" + worldGuid);
        self.ready = true;
        self.emit('changed');
        callback(null, self);
    });
};

Permissions.prototype.hasAppliedPermission = function(permissionNameOrId) {
    if (!this.ready) { throw new Error("Unable to check whether user has permission " + name + ": not yet ready."); }
    return this.appliedPermissions.indexOf(permissionNameOrId) !== -1 ||
           this.appliedPermissions.indexOf(PermissionsLookup.map[permissionNameOrId]) !== -1;
};

Permissions.prototype.has = Permissions.prototype.hasAppliedPermission;

Permissions.prototype.hasGlobalPermision = function(permissionNameOrId) {
    if (!this.ready) { throw new Error("Unable to check whether user has global permission " + name + ": not yet ready."); }
    return this.globalPermissions.indexOf(permissionNameOrId) !== -1 ||
           this.globalPermissions.indexOf(PermissionsLookup.map[permissionNameOrId]) !== -1;
};

Permissions.prototype.hasWorldPermision = function(permissionNameOrId) {
    if (!this.ready) { throw new Error("Unable to check whether user has global permission " + name + ": not yet ready."); }
    return this.worldPermissions.indexOf(permissionNameOrId) !== -1 ||
           this.worldPermissions.indexOf(PermissionsLookup.map[permissionNameOrId]) !== -1;
};

Permissions.prototype.toJSON = function() {
    return {
        world: PermissionsLookup.getPermissionNames(this.worldPermissions),
        global: PermissionsLookup.getPermissionNames(this.globalPermissions),
        applied: PermissionsLookup.getPermissionNames(this.appliedPermissions)
    };
};

module.exports = Permissions;