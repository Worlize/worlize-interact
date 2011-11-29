var serverConfig = require('../config'),
    redis = require('redis'),
    Log = require('../util/log');

var logger = Log.getLogger('model.RedisConnectionManager');

var RedisConnectionManager = function() {
    this.config = serverConfig.redisServers;
    this._servers = {};
};

RedisConnectionManager.prototype.getClient = function(serverName, instanceId) {
    var s = this;

    var keyName = (typeof(instanceId) === 'undefined') ? serverName : serverName + "-*-" + instanceId;
    if (keyName in this._servers) {
        return this._servers[keyName];
    }

    var client = this._servers[keyName] = this.createClient(serverName, keyName);
    
    client.on('ready', function() {
        if (serverConfig.log.redisConnection) {
            logger.info("Connected to server '" + serverName + "', key: " + keyName);
        }
    });
    client.on('end', function() {
        if (serverConfig.log.redisConnection) {
            logger.info("Disconnected from server '" + serverName + "', key: " + keyName);
        }
        delete s._servers[keyName];
    });
    
    return client;
};

RedisConnectionManager.prototype.createClient = function(serverName) {
    var c = this.config[serverName];
    if (c) {
        if (serverConfig.log.redisConnection) {
            logger.info("Connecting to server '" + serverName + "'");
        }

        var client = redis.createClient(
            c.port,
            c.host
        );

        client.select(c.db);

        client.addListener('error', function() {
            logger.fatal("Cannot establish connection to server '" + serverName + "'");
        });

        return client;
    }
    else {
        throw new Error("Cannot find configuration for redis server " + serverName);
    }
};

RedisConnectionManager.prototype.shutDown = function(callback) {
    var count = Object.keys(this._servers).length;
    
    function checkComplete() {
        if (count === 0) {
            if (typeof(callback) === 'function') {
                callback(null);
            }
        }
    }
    
    for (var keyName in this._servers) {
        var client = this._servers[keyName];
        if (!client.connected) {
            count --;
            continue;
        }
        logger.info("Shutting down connection, key: " + keyName);
        client.once('end', function() {
            count --;
            checkComplete();
        });
        client.quit()
    }
    
    if (count === 0 && typeof(callback) === 'function') {
        callback(null);
    }
};

RedisConnectionManager.getInstance = function() {
    if (RedisConnectionManager.instance) {
        return RedisConnectionManager.instance;
    }
    return RedisConnectionManager.instance = new RedisConnectionManager();
}

module.exports = RedisConnectionManager.getInstance();