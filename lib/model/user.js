var events = require('events'), 
    util = require('util'),
    redisConnectionManager = require('./redis_connection_manager'),
    MessageEncoder = require('../rpc/message_encoder'),
    UserState = require('./user_state'),
    Log = require('../util/log'),
    MoveMessage = require('../rpc/chatserver_messages/move'),
    NakedMessage = require('../rpc/chatserver_messages/naked'),
    DisplayDialogMessage = require('../rpc/chatserver_messages/display_dialog'),
    RoomMsgMessage = require('../rpc/chatserver_messages/room_msg'),
    RoomRedirectMessage = require('../rpc/chatserver_messages/room_redirect'),
    SetSimpleAvatarMessage = require('../rpc/chatserver_messages/set_simple_avatar'),
    PermissionsLookup = require('./lookup/permissions_lookup'),
    Permissions = require('./permissions'),
    Restrictions = require('./restrictions'),
    _ = require('underscore');
    
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
    this.permissions = new Permissions();
    this.restrictions = new Restrictions();
    this.stickyMessage = null;
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
User.prototype.loadPermissions = function(worldGuid, worldOwnerGuid, callback) {
    var isWorldOwner = this.guid === worldOwnerGuid;
    this.permissions.load(this.guid, worldGuid, isWorldOwner, callback);
};

User.prototype.hasAppliedPermission = function(permissionNameOrId) {
    return this.permissions.hasAppliedPermission(permissionNameOrId);
};

User.prototype.hasGlobalPermission = function(permissionNameOrId) {
    return this.permissions.hasGlobalPermission(permissionNameOrId);
};

User.prototype.hasWorldPermission = function(permissionNameOrId) {
    return this.permissions.hasWorldPermission(permissionNameOrId);
};

User.prototype.hasActiveRestriction = function(name) {
    return this.restrictions.hasActiveRestriction(name);
};

User.prototype.hasActiveGlobalRestriction = function(name) {
    return this.restrictions.hasActiveGlobalRestriction(name);
};

User.prototype.hasActiveWorldRestriction = function(name) {
    return this.restrictions.hasActiveWorldRestriction(name);
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
            this.state.avatar = null;
            this.state.save();
            msg = new NakedMessage();
            msg.user = this;
            this.currentRoom.broadcast(msg);
            msg = new RoomMsgMessage();
            msg.user = this;
            msg.text = "A moderator has pinned you in the corner."
            this.sendMessage(msg);
        }
    }
    else if (before['pin']) {
        this.position = before['pin'];
        delete before['pin'];
        msg = new MoveMessage();
        msg.user = this;
        this.currentRoom.broadcast(msg);
    }
    
    if (active('gag')) {
        if (!before['gag']) {
            before['gag'] = true;
            msg = new RoomMsgMessage();
            msg.user = this;
            msg.text = "A moderator has gagged you.  You may not speak until the gag has been removed."
            this.sendMessage(msg);
        }
    }
    else if (before['gag']) {
        delete before['gag'];
        msg = new RoomMsgMessage();
        msg.user = this;
        msg.text = "Your gag has been removed."
        this.sendMessage(msg);
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
                before['gag'] = true;
                msg = new RoomMsgMessage();
                msg.user = this;
                msg.text = "A moderator has revoked your ability to wear avatars."
                this.sendMessage(msg);
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