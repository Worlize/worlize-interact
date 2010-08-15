var sys = require('sys');

exports.Config = {

    // How often to send a "ping" msg to all clients
    pingInterval: 19000,

    roomWidth: 950,
    roomHeight: 530,

    // How often to update our status on the presence database
    updatePresenceInterval: 1000,

    // Should we host a flash socket policy file server in-process?
    // Normally we want to run a separate flash socket policy file server,
    // so leave this set to false unless you know what you're doing
    hostFlashPolicyServer: true,

    // Which domain do we allow websocket connections from?
    originPolicy: {
        allowedOrigin: '*:*'
    },
    
    // What to log
    log: {
        redisConnection: true,
    },
    
    supportedTransports: ['websocket', 'flashsocket', 'htmlfile', 'xhr-multipart', 'xhr-polling'],
    
    // Where to find each type of redis database...
    redisServers: {
        presence: {
            host: "127.0.0.1",
            port: 6379,
            db: 0
        },
        roomServerAssignments: {
            host: "127.0.0.1",
            port: 6379,
            db: 1
        },
        roomDefinitions: {
            host: "127.0.0.1",
            port: 6379,
            db: 2
        },
        cache: {
            host: "127.0.0.1",
            port: 6379,
            db: 3
        },
        pubsub: {
            host: "127.0.0.1",
            port: 6379,
            db: 4
        },
        railsSession: {
            host: "127.0.0.1",
            port: 6379,
            db: 5
        },
        assets: {
            host: "127.0.0.1",
            port: 6379,
            db: 6
        }
    }  
};