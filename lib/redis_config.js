var config = [
    {
        name: 'presence',
        host: "127.0.0.1",
        port: 6379,
        db: 0
    },
    {
        name: 'stats',
        host: "127.0.0.1",
        port: 6379,
        db: 9
    },
    {
        name: 'room_server_assignments',
        host: "127.0.0.1",
        port: 6379,
        db: 1
    },
    {
        name: 'room_definitions',
        host: "127.0.0.1",
        port: 6379,
        db: 2
    },
    {
        name: 'cache',
        host: "127.0.0.1",
        port: 6379,
        db: 3
    },
    {
        name: 'pubsub',
        host: "127.0.0.1",
        port: 6379,
        db: 4
    },
    {
        name: 'rails_session',
        host: "127.0.0.1",
        port: 6379,
        db: 5
    },
    {
        name: 'relationships',
        host: "127.0.0.1",
        port: 6379,
        db: 6
    },
    {
        name: 'currency',
        host: "127.0.0.1",
        port: 6379,
        db: 7
    },
    {
        name: 'preferences',
        host: "127.0.0.1",
        port: 6379,
        db: 8
    }
];

var configHash = {};
config.forEach(function(item) {
    configHash[item.name] = item;
});
module.exports = configHash;
