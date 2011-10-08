var sys = require('sys'),
    Room = require('./room'),
    redisConnectionManager = require('./redis_connection_manager');

var RoomManager = function(chatserver) {
    this.chatserver = chatserver;
    this.rooms = {};
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
    }
};

module.exports = RoomManager;
