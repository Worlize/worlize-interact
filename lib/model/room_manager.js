var sys = require('sys'),
    kiwi = require('kiwi'),
    Room = require('./room');

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
            this.chatserver.pubsub.subscribeTo("room:" + guid, function(channel, message) {
                try {
                    message = message.toString('utf8');
                }
                catch (e) { /* do nothing */ }
                room.handlePubSubMessage.call(room, channel, message);
            });
        }
        return room;
    },
    removeRoom: function(guid) {
        this.chatserver.pubsub.unsubscribeFrom("room:" + guid)
        delete this.rooms[guid];
    }
};

module.exports = RoomManager;
