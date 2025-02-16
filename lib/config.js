var redisConfig = require('./redis_config');
var mysqlConfig = require('./mysql_config');
var amazonConfig = require('./amazon_config');
var streamingConfig = require('./streaming_config').streamingConfig;

module.exports = {
    roomWidth: 950,
    roomHeight: 570,

    // Which domain do we allow websocket connections from?
    originPolicy: {
        allowedOrigin: '*:*'
    },
    
    // What to log
    log: {
        redisConnection: true,
    },
    
    defaultRoomBackgroundURL: "https://s3.amazonaws.com/background-images.worlize.com/default-room-background.png",
    
    // Where to find each type of redis database...
    redisServers: redisConfig,

	// Configuration of various Wowza media servers
	streamingConfig: streamingConfig,
	
	// Information about the mysql database(s)
	mysqlConfig: mysqlConfig,
	
	// Information about Amazon API stuff
	amazonConfig: amazonConfig
};