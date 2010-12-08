var sys = require('sys');
var redisConfig = require('./redis_config').redisConfig;

module.exports = {
    roomWidth: 950,
    roomHeight: 530,

    // How often to update our status on the presence database
    updatePresenceInterval: 500,

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
    
    transportOptions: {
      "xhr-polling": {
        closeTimeout: 4000,
        duration: 10000
      }
    },
    
    // Where to find each type of redis database...
    redisServers: redisConfig
};