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
    getRoom: function(guid) {
        var room = this.rooms[guid];
        if (!room) {
            var self = this;
            room = this.rooms[guid] = new Room(this.chatserver, guid);
            room.loadData(guid);
            room.addListener('empty', function() {
                self.removeRoom(guid);
            });
        }
        return room;
    },
    removeRoom: function(guid) {
        delete this.rooms[guid];
    },
    initPresenceInformation: function() {
        this.roomServerAssignmentsDB.del('roomsOnServer:' + this.chatserver.serverId);
    }
};

module.exports = RoomManager;
