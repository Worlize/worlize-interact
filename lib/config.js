var sys = require('sys');

exports.Config = {

    // How often to send a "ping" msg to all clients
    pingInterval: 19000,

    // How often to update our status on the presence database
    updatePresenceInterval: 10000,

    // Should we host a flash socket policy file server in-process?
    hostFlashPolicyServer: false,

    // Which domain do we allow websocket connections from?
    originPolicy: {
        allowedOrigin: '*:*'
    },
    
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