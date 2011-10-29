var sys = require('sys');
var redisConfig = require('./redis_config').redisConfig;
var streamingConfig = require('./streaming_config').streamingConfig;

module.exports = {
    roomWidth: 950,
    roomHeight: 530,

    // Which domain do we allow websocket connections from?
    originPolicy: {
        allowedOrigin: '*:*'
    },
    
    // What to log
    log: {
        redisConnection: true,
    },
    
    defaultRoomBackgroundURL: "http://background-images.worlize.com/default-room-background.png",
    
    // Where to find each type of redis database...
    redisServers: redisConfig,

	// Configuration of various Wowza media servers
	streamingConfig: streamingConfig
};