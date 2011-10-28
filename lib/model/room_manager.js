var sys = require('sys'),
    Room = require('./room'),
    redisConnectionManager = require('./redis_connection_manager');

var RoomManager = function(chatserver) {
    this.chatserver = chatserver;
    this.rooms = {};
    this.roomServerAssignmentsDB = redisConnectionManager.getClient('room_server_assignments');
    this.initPresenceInformation();
};

RoomManager.prototype = {
    getRoom: function(guid, callback) {
        var self = this;
        function fail(error) {
            if (typeof(callback) === 'function') {
                callback(error, null);
            }
        }
        var room = this.rooms[guid];
        if (room) {
            callback(null, room);
            return;
        }
        
        // Check to make sure the room is hosted on this server
        // TODO
        
        room = this.rooms[guid] = new Room(this.chatserver, guid);
        room.on('ready', function() {
            callback(null, room);
        });
        room.addListener('empty', function() {
            self.removeRoom(guid);
        });
        room.loadData(guid);
    },
    verifyRoomIsOnThisServer: function(guid, callback) {
        if (typeof(callback) !== 'function') {
            throw new Error("You must supply a callback function");
        }
        var self = this;
        var redis = this.roomServerAssignmentsDB;
        redis.hget('serverForRoom', guid, function(err, result) {
            if (err) {
                callback(err, null);
                return;
            }
            if (result === self.chatserver.serverId) {
                callback(null, {
                    verified: true,
                    actualServer: result
                });
            }
            else {
                self.getActiveServerIds(function(err, serverIds) {
                    if (err) {
                        callback(err);
                        return;
                    }
                    var assignedServer = serverIds[0];
                    redis.hset('serverForRoom', guid, assignedServer);
                    callback(null, {
                        verified: (assignedServer === self.chatserver.serverId),
                        actualServer: assignedServer
                    });
                });
            }
        });
    },
    removeRoom: function(guid) {
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
                callback(null, activeServerIds);
            });
        });
    },
    initPresenceInformation: function() {
        this.roomServerAssignmentsDB.del('roomsOnServer:' + this.chatserver.serverId);
    }
};

module.exports = RoomManager;
