var sys = require('sys'),
    Room = require('./room'),
    redisConnectionManager = require('./redis_connection_manager');

var RoomManager = function(chatserver) {
    this.chatserver = chatserver;
    this.pubsubSubscribe = redisConnectionManager.getClient('pubsub', 'subscribe');
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
            this.pubsubSubscribe.subscribe("room:" + guid);
            this.chatserver.pubsubMessageHandlers["room:" + guid] = function(channel, message) {
                try {
                    message = message.toString('utf8');
                }
                catch (e) { /* do nothing */ }
                room.handlePubSubMessage.call(room, channel, message);
            };
        }
        return room;
    },
    removeRoom: function(guid) {
        this.pubsubSubscribe.unsubscribe("room:" + guid)
        delete this.chatserver.pubsubMessageHandlers["room:" + guid];
        delete this.rooms[guid];
    }
};

module.exports = RoomManager;
