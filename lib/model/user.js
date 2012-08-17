var events = require('events'), 
    redisConnectionManager = require('./redis_connection_manager'),
    MessageEncoder = require('../rpc/message_encoder'),
    UserState = require('./user_state'),
    Log = require('../util/log'),
    MoveMessage = require('../rpc/chatserver_messages/move'),
    NakedMessage = require('../rpc/chatserver_messages/naked'),
    DisplayDialogMessage = require('../rpc/chatserver_messages/display_dialog'),
    RoomRedirectMessage = require('../rpc/chatserver_messages/room_redirect'),
    SetSimpleAvatarMessage = require('../rpc/chatserver_messages/set_simple_avatar'),
    Permissions = require('./lookup/permissions'),
    Restrictions = require('./restrictions');
    
var logger = Log.getLogger('model.User');
    
var User = function(guid, userName) {
    this.guid = guid;
    this.userName = userName;
    this.logNotation = null;
    this.session = null; // a reference to the Session model object
    this.connection = null; // a reference to the WebSocketConnection
    this.currentRoom = null; // a reference to the current Room model object
    this.position = [ 0, 0 ];
    this.state = null;
    this.permissions = [];
    this.permissionsDB = redisConnectionManager.getClient('permissions');
    this.restrictions = new Restrictions();
    this.restrictions.on('changed', this._handleRestrictionsChanged.bind(this));
    this.stateBeforeRestrictions = {};
};

User.load = function(guid, userName, callback) {
    var user = new User(guid, userName);
    user.loadData(callback);
};

User.prototype.leaveRoom = function() {
    if (this.currentRoom) {
        this.currentRoom.removeUser(this);
    }
};

User.prototype.loadData = function(callback) {
    var self = this;
    UserState.load(this.guid, function(err, result) {
        if (err) {
            callback(err);
            return;
        }
        self.state = result;
        callback(null, self);
    });
};

// user.loadPermissions([worldGuid], [callback]);
User.prototype.loadPermissions = function(worldGuid, callback) {
    if (typeof(worldGuid) === 'function') {
        callback = worldGuid;
        worldGuid = null;
    }
    if (typeof(callback) !== 'function') {
        callback = function(){};
    }
    
    if (this.currentRoom && this.currentRoom.definition.ownerGuid === this.guid) {
        // If we are the world owner we always have all permissions
        this.permissions = Permissions.ids.slice();
        callback(null, this.permissions);
        return;
    }

    var self = this;
    function handleResult(err, data) {
        if (err) {
            callback(err);
            return;
        }
        self.permissions = data;
        callback(null, data);
    }
    
    if (worldGuid) {
        this.permissionsDB.sunion(
            'g:' + this.guid,
            'w:' + worldGuid + ':' + this.guid,
            handleResult
        );
    }
    else {
        this.permissionsDB.smembers(
            'g:' + this.guid,
            handleResult
        );
    }
};

User.prototype.getPermissionNames = function() {
    return this.permissions.map(function(id) {
        return Permissions.map[id];
    }).filter(function(permissionName) {
        return permissionName !== undefined;
    });
};

User.prototype.getPermissionIds = function() {
    return this.permissions;
};

User.prototype.hasPermission = function(permissionNameOrId) {
    return this.permissions.indexOf(permissionNameOrId) !== -1 ||
           this.permissions.indexOf(Permissions.map[permissionNameOrId]) !== -1;
};

User.prototype.hasActiveRestriction = function(name) {
    return this.restrictions.hasActiveRestriction(name);
};

User.prototype._handleRestrictionsChanged = function() {
    this.applyRestrictions();
};

User.prototype.applyRestrictions = function() {
    if (!this.currentRoom) { return; }
    var active = this.restrictions.hasActiveRestriction.bind(this.restrictions);
    var msg;
    var before = this.stateBeforeRestrictions;
  
    if (active('pin')) {
        if (!before['pin']) {
            before['pin'] = this.position;
            this.position = [925,525];
            msg = new MoveMessage();
            msg.user = this;
            this.currentRoom.broadcast(msg);
            msg = new NakedMessage();
            msg.user = this;
            this.currentRoom.broadcast(msg);
        }
    }
    else if (before['pin']) {
        this.position = before['pin'];
        delete before['pin'];
        msg = new MoveMessage();
        msg.user = this;
        this.currentRoom.broadcast(msg);
    }
    
    if (active('block_avatars')) {
        if (!before['block_avatars']) {
            before['block_avatars'] = true;
            if (this.state.avatar && this.state.avatar.type === 'simple') {
                this.state.avatar = null;
                this.state.save();
                msg = new NakedMessage();
                msg.user = this;
                this.currentRoom.broadcast(msg);
            }
        }
    }
    else if (before['block_avatars']) {
        delete before['block_avatars'];
    }
    
    if (active('block_webcams')) {
        if (!before['block_webcams']) {
            before['block_webcams'] = true;
            if (this.state.avatar && this.state.avatar.type === 'video') {
                this.state.avatar = null;
                this.state.save();
                msg = new NakedMessage();
                msg.user = this;
                this.currentRoom.broadcast(msg);
            }
        }
    }
    else if (before['block_webcams']) {
        delete before['block_webcams'];
    }
    
    if (active('ban')) {
        if (!before['ban']) {
            before['ban'] = true;
            msg = new DisplayDialogMessage();
            msg.message = "A moderator has banished you!  You may be able to return after your banishment expires.";
            this.sendMessage(msg);
            
            msg = new RoomRedirectMessage();
            msg.roomGuid = "home";
            this.sendMessage(msg);
            this.connection.close();
            return;
        }
    }
};

User.prototype.destroy = function() {
    logger.debug2("User.destroy() username: " + this.userName, this.logNotation);
    this.leaveRoom();
};

User.prototype.sendMessage = function(message) {
    if (this.connection.connected) {
        message.send(this);
    }
};

module.exports = User;