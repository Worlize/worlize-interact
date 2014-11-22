var util = require('util'),
    fs = require('fs'),
    events = require('events'),
    config = require('../config'),
    Banlist = require('./banlist'),
    LoosePropList = require('./loose_prop_list'),
    UserEnterMessage = require('../rpc/chatserver_messages/user_enter'),
    UserLeaveMessage = require('../rpc/chatserver_messages/user_leave'),
    RoomDefinitionMessage = require('../rpc/chatserver_messages/room_definition'),
    RoomDefinition = require('./room_definition'),
    SetVideoServerMessage = require('../rpc/chatserver_messages/set_video_server'),
    SayMessage = require('../rpc/chatserver_messages/say'),
    DisconnectMessage = require('../rpc/chatserver_messages/disconnect'),
    DisplayDialogMessage = require('../rpc/chatserver_messages/display_dialog'),
    NakedMessage = require('../rpc/chatserver_messages/naked'),
    RoomPopulationUpdateMessage = require('../rpc/chatserver_messages/room_population_update'),
    RoomRedirectMessage = require('../rpc/chatserver_messages/room_redirect'),
    RoomMsgMessage = require('../rpc/chatserver_messages/room_msg'),
    SyncedListDumpMessage = require('../rpc/chatserver_messages/synced_list_dump'),
    SyncedDataDumpMessage = require('../rpc/chatserver_messages/synced_data_dump'),
    UnlockRoomMessage = require('../rpc/chatserver_messages/unlock_room'),
    LockRoomMessage = require('../rpc/chatserver_messages/lock_room'),
    UserPermissionsChangedMessage = require('../rpc/chatserver_messages/user_permissions_changed'),
    MessageEncoder = require('../rpc/message_encoder'),
    StateHistoryList = require('./state_history_list'),
    redisConnectionManager = require('./redis_connection_manager'),
    pubsubManager = require('./pubsub_manager'),
	streamingServerBalancer = require('./streaming_server_balancer'),
	Log = require('../util/log');
	
var logger = Log.getLogger('model.Room');

var commandHandlers = {};

(function() {
    var directory = __dirname + "/../command_handlers";
    fs.readdirSync(directory).forEach(function(filename) {
        if (/^\._/.test(filename)) {
            // don't load text editor temp files.
            return;
        }
        var handler = require(directory + '/' + filename);
        if (handler.commandName) {
            commandHandlers[handler.commandName] = handler;
        }
        else {
            logger.warn("Command handler in " + directory + "/" + filename + " did not expose a messageId.  Skipping.");
        }
    });
})();

var Room = function(chatserver, guid) {
    events.EventEmitter.call(this);
    var self = this;
    this.roomServerAssignmentsDB = redisConnectionManager.getClient('room_server_assignments');
    this.roomDefinitionsDB = redisConnectionManager.getClient('room_definitions');

    if (!chatserver) {
        throw new Error("You must provide a chatserver instance.")
    }

    this.guid = guid;
    this.chatserver = chatserver;
    this.definition = null;
    this.users = [];
    this.kickedUsers = {};
    this.usersByUserGuid = {};
    this.appStateHistoryLists = {};
    this.appStateHistoryListsResetRequested = false;
    this.appSyncedDataStores = {};
    this.appSyncedDataResetRequested = false;
    
    this.locked = false;
    this.refreshLockInterval = null;
    
	this.streamingServer = "rtmp://" + streamingServerBalancer.getServer() + "/videochat";
    
    // Update redis database to reflect that this room is hosted here
    this.refreshRedisServerAssignmentKey();
    // Refresh redis key every 4:30
    this.redisServerAssignmentIntervalID = setInterval(this.refreshRedisServerAssignmentKey.bind(this), 270000);
    
    this.roomServerAssignmentsDB.sadd('roomsOnServer:'+this.chatserver.serverId, this.guid);
    this.roomServerAssignmentsDB.del('roomUsers:'+this.guid);
    this.roomServerAssignmentsDB.zadd('activeRooms', 0, this.guid);
    
    this.pubSubMessageHandler = this.handlePubSubMessage.bind(this);
    pubsubManager.subscribe("room:"+this.guid, this.pubSubMessageHandler);
    
    this.subscribedToWorldPubSubChannel = false;
    this.worldPubSubMessageHandler = this.handleWorldPubSubMessage.bind(this);
    // Will subscribe to the world broadcast channel when we find out what
    // the world guid is.
    
    this.loosePropList = new LoosePropList(this);
};
util.inherits(Room, events.EventEmitter);

Room.prototype.handleChatCommand = function(commandName, from, target, paramString) {
    if (!from || !from.guid) {
        throw new Error("You must supply a 'from' user.");
    }
    if (typeof(commandName) !== 'string') {
        throw new Error("You must specify a string commandName.");
    }

    if (typeof(target) === 'string') {
        target = this.getUserByUserName(target);
    }
    
    // Find command function
    var cmdFunction = commandHandlers[commandName.toLocaleLowerCase()];
    if (typeof(cmdFunction) === 'function') {
        cmdFunction(this, from, target, paramString);
    }
    else {
        var roomMsg = new RoomMsgMessage();
        roomMsg.text = "Unknown command: " + commandName;
        roomMsg.user = from;
        from.sendMessage(roomMsg);
        return;
    }
};

Room.prototype.getUserByUserName = function(userName) {
    if (typeof(userName) !== 'string') {
        return null;
    }
    var lcUsername = userName.toLocaleLowerCase();
    for (var i=0, len=this.users.length; i < len; i++) {
        var user = this.users[i];
        if (user.userName.toLocaleLowerCase() === lcUsername) {
            return user;
        }
    }
    return null;
};

Room.prototype.load = function(callback) {
    var self = this;
    logger.debug2("Loading room " + this.guid);
    RoomDefinition.load(this.guid, function(err, result) {
        if (err) {
            callback(err);
            return;
        }
        self.definition = result;
        self.definition.room = self;
        logger.info("Room " + self.guid + " definition loaded. Name: " + result.name);
        
        // Now that we know the world guid, we can subscribe to the world
        // broadcast channel.
        if (!self.subscribedToWorldPubSubChannel) {
            pubsubManager.subscribe("world:" + self.definition.worldGuid, self.worldPubSubMessageHandler);
            self.subscribedToWorldPubSubChannel = true;
        }
        
        self.initializeAllAppsData();
        
        callback(null);
    });
};

Room.prototype.initializeAllAppsData = function() {
    var self = this;
    if (this.appStateHistoryListsResetRequested) {
        this.appStateHistoryLists = {};
        this.appStateHistoryListsResetRequested = false;
    }
    if (this.appSyncedDataResetRequested) {
        this.appSyncedDataStores = {};
        this.appSyncedDataResetRequested = false;
    }

    this.definition.items.forEach(function(item) {
        if (item.type === 'app') {
            self.initializeAppData(item.guid);
        }
    });
};

Room.prototype.initializeAppData = function(appGuid) {
    if (!this.appStateHistoryLists[appGuid]) {
        this.appStateHistoryLists[appGuid] = new StateHistoryList(appGuid);
    }
    if (!this.appSyncedDataStores[appGuid]) {
        this.appSyncedDataStores[appGuid] = {};
    }
};

Room.prototype.checkIsModerator = function(user, callback) {
    if (this.definition.ownerGuid === user.guid) {
        callback(null, true);
        return;
    }
    this.roomDefinitionsDB.sismember('global_moderators', user.guid, function(err, result) {
        if (err) {
            callback(err);
            return
        }
        callback(null, result);
    });
};

Room.prototype.checkCanAuthor = function(user, callback) {
    if (this.definition.ownerGuid === user.guid) {
        callback(null, true);
        return;
    }
    callback(null, false);
};

Room.prototype.reloadRoomDefinitionAndNotifyUsers = function() {
    var self = this;
    this.appStateHistoryListsResetRequested = true;
    this.appSyncedDataResetRequested = true;
    this.load(function(err, data) {
        if (err) {
            // TODO: Handle possible error
            return;
        }
        var roomDefinitionMessage = new RoomDefinitionMessage(self.chatserver);
        roomDefinitionMessage.roomDefinition = self.definition;
        roomDefinitionMessage.room = self;
        self.broadcast(roomDefinitionMessage);
    });
};

Room.prototype.refreshRedisServerAssignmentKey = function() {
    // Redis key expires after 5:00
    this.roomServerAssignmentsDB.setex('serverForRoom:' + this.guid, 300, this.chatserver.serverId);
};

Room.prototype.addUser = function(user) {
    var self = this;
    
    logger.debug("Adding user " + user.guid + " to room " + this.guid, user.logNotation);

    // If this user is already in the room, something went wrong and we
    // need to boot the old incarnation of the user before continuing.
    var oldUser = this.usersByUserGuid[user.guid];
    if (oldUser) {
        logger.error("addUser: User already exists in room!  Disconnecting previous user.", user.logNotation);
        oldUser.connection.drop(1000);
    }
    
    // Set a reference to the room in the user object
    user.currentRoom = this;
    
    // Load the user's permissions for the current world
    user.loadPermissions(
        this.definition.worldGuid,
        this.definition.ownerGuid,
        function(err, permissions) {
            // If something happened and the connection has been dropped, just bail.
            if (!user.connection.connected) { return; }
            if (err) {
                logger.error("Disconnecting user: Unable to load user permissions: " + err, user.logNotation);
                failUserEntry();
                return;
            }
            loadRestrictions();
        }
    );
    
    function loadRestrictions() {
        user.restrictions.load(user.guid, self.definition.worldGuid, function(err, restrictions) {
            // If something happened and the connection has been dropped, just bail.
            if (!user.connection.connected) { return; }
            if (err) {
                logger.error("Disconnecting user: Unable to load restrictions: " + err, user.logNotation);
                failUserEntry();
                return;
            }
            user.monitorRestrictionChanges();
            checkForIPBan();
        });
    }
    
    function checkForIPBan() {
        Banlist.isIPBanned(user.connection.remoteAddress, function(err, result) {
            // If something happened and the connection has been dropped, just bail.
            if (!user.connection.connected) { return; }
            if (err) {
                logger.error(err, user.logNotation);
                // If there's a system error while checking the banlist, let people in anyway.
                // (So no "return;" here)
            }
            if (result) {
                // Send them packing if their IP is banned!
                logger.info("Disconnecting User due to banned IP. action=rejected_banned_ip", user.logNotation);
                var dialogMsg = new DisplayDialogMessage();
                dialogMsg.message = "You are currently banished from Worlize.  You may return when your penalty expires.";
                dialogMsg.redirectToHomepage = true;
                user.sendMessage(dialogMsg);
                user.connection.close();
                return;
            }
            continueAfterLoadingData();
        });
    }
    
    function continueAfterLoadingData() {
        function sendHome(message) {
            if (!user.connection.connected) { return; }
            var dialogMsg = new DisplayDialogMessage();
            dialogMsg.message = message;
            user.sendMessage(dialogMsg);
            
            var redirectMsg = new RoomRedirectMessage();
            redirectMsg.roomGuid = "home";
            user.sendMessage(redirectMsg);
            user.connection.close();
        }
        
        // If something happened and the connection has been dropped, just bail.
        if (!user.connection.connected) { return; }
        
        // Send them packing if they've been banned...
        if (user.hasActiveGlobalRestriction('ban')) {
            var dialogMsg = new DisplayDialogMessage();
            dialogMsg.message = "You are currently banished from Worlize.  You may return when your penalty expires.";
            dialogMsg.redirectToHomepage = true;
            user.sendMessage(dialogMsg);
            user.connection.close();
            return;
        }
        else if (user.hasActiveWorldRestriction('ban')) {
            return sendHome("Your banishment is still in effect.");
        }
        
        // ...or if they've been kicked...
        if (self.kickedUsers[user.guid] &&
            user.permissions.worldPermissions.length === 0 &&
            !user.hasGlobalPermission('can_moderate_globally'))
        {
            return sendHome("You've been kicked from that room.");
        }
        
        // ...or if the room is locked...
        if (self.locked &&
            user.guid !== self.definition.ownerGuid &&
            user.permissions.worldPermissions.length === 0 &&
            !user.hasGlobalPermission('can_moderate_globally'))
        {
            return sendHome("Sorry, the room is locked.");
        }
        
        // If webcams/avatars aren't allowed in this room, make sure to remove
        // them from the user's costume before entering.
        if (self.definition.properties.noWebcams && user.state.avatar && user.state.avatar.type === 'video') {
            user.state.avatar = null;
            user.state.save();
        }
        else if (self.definition.properties.noAvatars && user.state.avatar && user.state.avatar.type !== 'video') {
            user.state.avatar = null;
            user.state.save();
        }
        
        // Select a random physical position in the room for the new user
        user.position = [
            60 + Math.floor(Math.random() * (config.roomWidth - 120)),
            60 + Math.floor(Math.random() * (config.roomHeight - 140))
        ];

        // Send the room definition to the new user
        var roomDefinitionMessage = new RoomDefinitionMessage(self.chatserver);
        roomDefinitionMessage.roomDefinition = self.definition;
        roomDefinitionMessage.room = self;
        user.sendMessage(roomDefinitionMessage);

        // Send the StateHistoryList and SyncedDataStore for all apps in the room to the new user
        var apps = self.definition.items.filter(function(item) { return item.type === 'app'; });
        for (var i=0,len=apps.length; i < len; i ++) {
            var app = apps[i];
            var syncedListDumpMessage = new SyncedListDumpMessage();
            syncedListDumpMessage.appGuid = app.guid;
            syncedListDumpMessage.stateHistoryList = self.appStateHistoryLists[app.guid];
            user.sendMessage(syncedListDumpMessage);

            var syncedDataDumpMessage = new SyncedDataDumpMessage();
            syncedDataDumpMessage.appGuid = app.guid;
            syncedDataDumpMessage.syncedDataStore = self.appSyncedDataStores[app.guid];
            user.sendMessage(syncedDataDumpMessage);
        }

        // Tell the user which video server to connect to for this room
        var videoServerMessage = new SetVideoServerMessage(self.chatserver);
        videoServerMessage.room = self;
        user.sendMessage(videoServerMessage);

        // Send user_enter messages for all the existing occupants to the new entrant
        for (var i=0,len=self.users.length; i < len; i ++) {
            var userEnterMessage = new UserEnterMessage(self.chatserver);
            userEnterMessage.user = self.users[i];
            user.sendMessage(userEnterMessage);
            if (self.users[i].stickyMessage) {
                var sayMessage = new SayMessage(self.chatserver);
                sayMessage.user = self.users[i];
                sayMessage.text = self.users[i].stickyMessage;
                user.sendMessage(sayMessage);
            }
        }
        
        // Add the user to the room's lists of users
        self.users.push(user);
        self.usersByUserGuid[user.guid] = user;

        // Update the user list for the room in Redis and update the score in
        // the sorted set of active rooms
        var multi = self.roomServerAssignmentsDB.multi();
        multi.sadd('roomUsers:' + self.guid, user.guid);
        multi.zadd('activeRooms', self.users.length, self.guid);
        multi.exec(function(err, result) {
            if (err) {
                logger.error("Disconnecting user: Redis error while updating room occupancy data: " + err, user.logNotation);
                failUserEntry();
                return;
            }
        });
        
        // notify all users of the new entry
        var userEnterMessage = new UserEnterMessage(self.chatserver);
        userEnterMessage.user = user;
        self.broadcast(userEnterMessage);

        // Send a notification on the world global pubsub channel
        var populationUpdateMessage = new RoomPopulationUpdateMessage(self.chatserver);
        populationUpdateMessage.room = self;
        populationUpdateMessage.userAdded = user;
        pubsubManager.publish(
            'world:' + self.definition.worldGuid,
            MessageEncoder.encode(populationUpdateMessage.getSerializableHash())
        );
        
        user.applyRestrictions();
    }
    
    function failUserEntry() {
        // Something went horribly wrong!!
        if (!user.connection.connected) { return; }
        var disconnectMessage = new DisconnectMessage(self.chatserver);
        disconnectMessage.errorCode = 1004;
        disconnectMessage.errorMessage = "An error occurred on the server while joining the room.";
        user.sendMessage(disconnectMessage);
        setTimeout(function() {
            user.connection.drop(1000); // 1000 = Normal WebSocket Close
        }, 100);
    }
};

Room.prototype.removeUser = function(user) {
    if (this.hasUser(user)) {
        logger.debug("User " + user.userName + " leaving room " + this.guid, user.logNotation);
        
        // notify all users of the user leaving
        var userLeaveMessage = new UserLeaveMessage(this.chatserver);
        userLeaveMessage.user = user;
        this.broadcast(userLeaveMessage);

        // Remove user from room's data structures
        this.users.splice(this.users.indexOf(user), 1);
        delete this.usersByUserGuid[user.guid];

        // Update the user list for the room in Redis and update the score
        // in the sorted set of active rooms
        var multi = this.roomServerAssignmentsDB.multi();
        multi.srem('roomUsers:' + this.guid, user.guid);
        multi.zadd('activeRooms', this.users.length, this.guid);
        multi.exec(function(err, results) {
            if (err) {
                // Something went horribly wrong with redis!
                logger.error("Redis error while updating room occupancy data: " + err, user.logNotation);
            }
        });
    
        // Send a notification on the world global pubsub channel
        var populationUpdateMessage = new RoomPopulationUpdateMessage(this.chatserver);
        populationUpdateMessage.room = this;
        populationUpdateMessage.userRemoved = user;
        pubsubManager.publish('world:' + this.definition.worldGuid, MessageEncoder.encode(populationUpdateMessage.getSerializableHash()));
    }
    else {
        logger.warn("Cannot remove user: they are not in the room!", user.logNotation);
    }
    
    if (user.currentRoom) {
      // Unset the reference to the current room in the user object
      user.currentRoom = null;
    
      user.afterRemovedFromRoom();
    }

    this.checkIfRoomIsEmpty();
};

Room.prototype.kickUser = function(user) {
    if (typeof(user) === 'string') {
        user = this.usersByUserGuid[user];
    }
    if (!user) { return; }
    
    logger.info("action=user_kicked user=" + user.guid + " room=" + this.guid);
    
    this.kickedUsers[user.guid] = true;
    
    var roomMsg = new RoomMsgMessage();
    roomMsg.text = "You have been kicked from the room.";
    roomMsg.user = user;
    user.sendMessage(roomMsg);
    
    // TODO: We really should look up the user's home world entrance guid here
    // but it's in MySQL which we're not connected to in Node yet.
    var redirectMsg = new RoomRedirectMessage();
    redirectMsg.roomGuid = "home";
    user.sendMessage(redirectMsg);
    user.connection.close();
};

Room.prototype.unkickUser = function(userGuid) {
    if (typeof(userGuid) !== 'string') {
        // Handle being passed a user object
        userGuid = userGuid.guid;
    }
    delete this.kickedUsers[userGuid];
};

Room.prototype.hasUser = function(user) {
    if (typeof(user) === 'string') {
        user = this.usersByUserGuid[user];
    }
    if (!user) {
        return false;
    }
    return (this.usersByUserGuid[user.guid] === user);
};

Room.prototype.getUserByGuid = function(guid) {
    return this.usersByUserGuid[guid];
};

Room.prototype.broadcast = function(message, excludeUserGuid) {
    for (var i=0,len=this.users.length; i < len; i ++) {
        var user = this.users[i];
        if (user.guid !== excludeUserGuid) {
            user.sendMessage(message);
        }
    }
};

Room.prototype.handlePubSubMessage = function(message) {
    var self = this;
    var decodedMessage;
    try {
        decodedMessage = MessageEncoder.decode(message);
    }
    catch (e) {
        logger.error("Error while decoding message from room broadcast channel: " + e);
        return;
    }

    if (!('msg' in decodedMessage)) {
        logger.error("Message from room broadcast channel is missing the 'msg' key.  Message: " + message);
        return;
    }
    
    if (decodedMessage.msg === 'object_removed') {
        // If an object is removed from the room, make sure to get rid of any
        // shared history state data for it.
        delete this.appStateHistoryLists[decodedMessage.data.guid];
        delete this.appSyncedDataStores[decodedMessage.data.guid];
    }
    
    switch (decodedMessage.msg) {
        case "room_definition_updated":
            if (decodedMessage.data.guid === this.guid && this.definition) {
                this.definition.handleRoomDefinitionUpdated(decodedMessage.data);
                this.forwardMessageToUsers(decodedMessage);
            }
            // this.reloadRoomDefinitionAndNotifyUsers();
            break;
        
        case "update_room_property":
            if (decodedMessage.data.name) {
                this.updateRoomProperty(decodedMessage.data.name, decodedMessage.data.value);
            }
            this.forwardMessageToUsers(decodedMessage);
            break;
            
        case "remove_item":
            this.definition.removeItem(decodedMessage.data.guid);
            this.forwardMessageToUsers(decodedMessage);
            break;
        
        case "user_restrictions_changed":
            if (decodedMessage.data.user) {
                var user = this.getUserByGuid(decodedMessage.data.user);
                if (user) {
                    user.restrictions.reload();
                }
            }
            break;

        // These messages need to trigger a room definition reload
        // TODO: Move this updating functionality from Ruby into the
        // interactivity server.
        case "youtube_player_added":
        case "youtube_player_moved":
        case "youtube_player_data_updated":
        case "youtube_player_removed":
        case "new_object":
        case "object_moved":
        case "object_updated":
        case "object_removed":
            logger.error("WE SHOULDN'T BE RECEIVING THESE MESSAGES ANY MORE.  Received: " + JSON.stringify(decodedMessage));
            this.load(function(err, data) {
                if (err) {
                    // TODO: Handle possible errors?
                    
                    // The message should be forwarded to clients even if there
                    // is an error, for example when a room is being deleted
                    // it will send out object_removed messages but the actual
                    // room definition may no longer be available in the DB
                    // by the time we try to process this.
                }
                self.forwardMessageToUsers(decodedMessage);
            });
            break;
            
        default:
            this.forwardMessageToUsers(decodedMessage);
            break;
    }
};

Room.prototype.updateRoomProperty = function(name, value) {
    this.definition.properties[name] = value;
    if (value === true) {
        switch(name) {
            case "noProps":
                this.loosePropList.clearLooseProps();
                break;
            case "noAvatars":
                this.removeAllAvatars();
                break;
            case "noWebcams":
                this.removeAllWebcams();
                break;
        }
    }
};

Room.prototype.removeAllAvatars = function() {
    var self = this;
    var nakedMsg;
    this.users.forEach(function(user) {
        if (user.state.avatar && user.state.avatar.type !== 'video') {
            user.state.avatar = null;
            user.state.save();
            nakedMsg = new NakedMessage(self.chatserver);
            nakedMsg.user = user;
            self.broadcast(nakedMsg);
        }
    });
};

Room.prototype.removeAllWebcams = function() {
    var self = this;
    var nakedMsg;
    this.users.forEach(function(user) {
        if (user.state.avatar && user.state.avatar.type === 'video') {
            user.state.avatar = null;
            user.state.save();
            nakedMsg = new NakedMessage(self.chatserver);
            nakedMsg.user = user;
            self.broadcast(nakedMsg);
        }
    });
};

Room.prototype.handleWorldPubSubMessage = function(message) {
    var self = this;
    var decodedMessage;
    try {
        decodedMessage = MessageEncoder.decode(message);
    }
    catch (e) {
        logger.error("Error while decoding message from world broadcast channel: " + e);
        return;
    }

    if (!('msg' in decodedMessage)) {
        logger.error("Message from world broadcast channel is missing the 'msg' key.  Message: " + message);
        return;
    }
    
    switch (decodedMessage.msg) {
        case "user_updated":
            if (decodedMessage.data.guid) {
                var user = this.getUserByGuid(decodedMessage.data.guid);
                if (user) {
                    logger.info("User " + user.guid + " changed names from \"" +
                                user.userName + "\" to \"" + decodedMessage.data.username + "\"");
                    user.userName = decodedMessage.data.username
                }
                this.forwardMessageToUsers(decodedMessage);
            }
            break;

        case "user_permissions_changed":
            if (decodedMessage.data.guid) {
                var user = this.getUserByGuid(decodedMessage.data.guid);
                if (user) {
                    logger.info("Reloading permissions for user", user.logNotation);
                    user.permissions.reload(function(err, permissions) {
                        if (err) {
                            logger.error("Unable to reload permissions", user.logNotation);
                        }
                        var userPermissionsChangedMessage = new UserPermissionsChangedMessage();
                        userPermissionsChangedMessage.user = user;
                        self.broadcast(userPermissionsChangedMessage);
                    });
                }
            }
            break;
        
        default:
            this.forwardMessageToUsers(decodedMessage);
            break;
    }
};

Room.prototype.forwardMessageToUsers = function(message) {
    var encodedMessage = MessageEncoder.encode(message);
    this.users.forEach(function(user) {
        user.connection.send(encodedMessage);
    });
};

Room.prototype.checkIfRoomIsEmpty = function() {
    if (this.users.length === 0) {
        this.destroy();
    }
};

Room.prototype.lock = function(user) {
    if (this.locked) { return; }
    this.locked = true;
    // Refresh the lock status in Redis every 60 seconds.
    this.refreshLockInterval = setInterval(this.refreshLock.bind(this), 60000);
    this.refreshLock();

    var msg = new LockRoomMessage();
    msg.user = user;
    msg.room = this;
    this.broadcast(msg);
    
    logger.debug("Room " + this.guid + " locked");
};

Room.prototype.unlock = function(user) {
    if (!this.locked) { return; }
    this.locked = false;
    clearInterval(this.refreshLockInterval);
    this.roomServerAssignmentsDB.del("lock:" + this.guid);
    
    var msg = new UnlockRoomMessage();
    msg.user = user;
    msg.room = this;
    this.broadcast(msg);
    
    logger.debug("Room " + this.guid + " unlocked");
};

Room.prototype.refreshLock = function() {
    // Set the lock status in Redis to expire after 70 seconds.
    this.roomServerAssignmentsDB.setex("lock:" + this.guid, 70, 1);
};

Room.prototype.destroy = function() {
    if (this.redisServerAssignmentIntervalID) {
        clearInterval(this.redisServerAssignmentIntervalID);
        this.redisServerAssignmentIntervalID = null;
    }
    if (this.locked) {
        this.locked = false;
        clearInterval(this.refreshLockInterval);
    }
    var multi = this.roomServerAssignmentsDB.multi();
    multi.del('lock:' + this.guid);
    multi.del('serverForRoom:' + this.guid);
    multi.srem('roomsOnServer:'+this.chatserver.serverId, this.guid);
    multi.del('roomUsers:'+this.guid);
    multi.zrem('activeRooms', this.guid);
    multi.exec(function(err, results) {
        if (err) {
            // Something went horribly wrong with redis!
            logger.error("Redis error while removing newly emptied room: " + err);
        }
    });
    pubsubManager.unsubscribe('room:' + this.guid, this.pubSubMessageHandler);
    if (this.definition) {
        pubsubManager.unsubscribe("world:" + this.definition.worldGuid, this.worldPubSubMessageHandler);
    }
    logger.info("Destroyed room " + this.guid + " - " + this.definition.name);
    this.emit('empty');
};


module.exports = Room;
