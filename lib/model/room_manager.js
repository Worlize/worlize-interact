var Room = require('./room'),
    Log = require('../util/log'),
    redisConnectionManager = require('./redis_connection_manager');

var logger = Log.getLogger('model.RoomManager');

var RoomManager = function(chatserver) {
    this.chatserver = chatserver;
    this.rooms = {};
    this.loadingRooms = {};
    this.roomServerAssignmentsDB = redisConnectionManager.getClient('room_server_assignments');
    this.initPresenceInformation();
};

RoomManager.prototype = {
    getRoom: function(guid, callback) {
        var self = this;
        var room = this.rooms[guid];
        
        // If we already have the room, just return it immediately.
        if (room) {
            callback(null, room);
            return;
        }
        
        // Handle multiple simultaneous requests for the same room
        var loadingHandlerQueue = this.loadingRooms[guid];
        if (loadingHandlerQueue) {
            if (logger.shouldLogLevel('debug3')) {
                logger.debug3("Room " + guid + " already loading, queuing additional callback");                
            }
            loadingHandlerQueue.push(callback);
            return;
        }

        if (logger.shouldLogLevel('debug3')) {
            logger.debug3("Adding room " + guid);
        }
        loadingHandlerQueue = this.loadingRooms[guid] = [callback];
        room = new Room(this.chatserver, guid);
        room.once('empty', function() {
            self.removeRoom(guid);
        });
        room.load(function(err, result) {
            var callbacks;
            if (err) {
                // fail
                self.removeRoom(guid);
                callbacks = self.loadingRooms[guid];
                for (var i=0,len=callbacks.length; i < len; i++) {
                    callbacks[i](err);
                }
                return;
            }
            // success!
            self.rooms[guid] = room;
            callbacks = self.loadingRooms[guid];
            delete self.loadingRooms[guid];
            if (logger.shouldLogLevel('debug3')) {
                logger.debug3("Room loaded, firing callbacks.");
            }
            for (var i=0,len=callbacks.length; i < len; i++) {
                callbacks[i](null, room);
            }
        });
    },
    verifyRoomIsOnThisServer: function(guid, callback) {
        var self = this;
        if (this.rooms[guid] || this.loadingRooms[guid]) {
            // the room is already running or being loaded on this server,
            // so we don't need to check against the redis database.
            callback(null, true);
            return;
        }
        var redis = this.roomServerAssignmentsDB;
        redis.get('serverForRoom:' + guid, function(err, result) {
            if (err) {
                callback(err, null);
                return;
            }
            if (result === self.chatserver.serverId) {
                callback(null, true);
            }
            else {
                callback(null, false);
            }
        });
    },
    removeRoom: function(guid) {
        if (logger.shouldLogLevel('debug2')) {
            logger.debug2("Removing room " + guid);
        }
        delete this.rooms[guid];
    },
    
    // Returns a list of active server ids, sorted by the number of connected
    // users, ascending.
    getActiveServerIds: function(callback) {
        var activeServerIds = [];
        var redis = this.roomServerAssignmentsDB;
        redis.zrange('serverIds', '0', '-1', function(err, serverIds) {
            if (err) {
                callback(err, null);
                return;
            }
            
            // Shortcut for no serverIds found.
            if (serverIds.length === 0) {
                callback(null, serverIds);
                return;
            }
            
            var multi = redis.multi();
            for (var i=0, len=serverIds.length; i < len; i++) {
                multi.get('serverStatus:' + serverIds[i]);
            }
            multi.exec(function(err, replies) {
                for (var i=0, len=replies.length; i < len; i++) {
                    if (replies[i] !== null) {
                        activeServerIds.push(serverIds[i]);
                    }
                }
                if (logger.shouldLogLevel('debug3')) {
                    logger.debug3("Active server IDs result: " + activeServerIds.join(','));
                }
                callback(null, activeServerIds);
            });
        });
    },
    initPresenceInformation: function() {
        this.roomServerAssignmentsDB.del('roomsOnServer:' + this.chatserver.serverId);
    }
};

module.exports = RoomManager;
