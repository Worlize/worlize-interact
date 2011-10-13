var sys = require('sys'),
    serverConfig = require('../config'),
    redis = require('redis');

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
            console.log("Connected to redis server '" + serverName + "', key: " + keyName);
        }
    });
    client.on('end', function() {
        if (serverConfig.log.redisConnection) {
            console.log("Redis server '" + serverName + "', key: " + keyName + " disconnected");
        }
        delete s._servers[keyName];
    });
    
    return client;
};

RedisConnectionManager.prototype.createClient = function(serverName) {
    var c = this.config[serverName];
    if (c) {
        if (serverConfig.log.redisConnection) {
            console.log("Connecting to redis server '" + serverName + "'");
        }

        var client = redis.createClient(
            c.port,
            c.host
        );

        client.select(c.db);

        client.addListener('error', function() {
            console.log("FATAL: Cannot establish connection to redis server '" + serverName + "'");
        });

        return client;
    }
    else {
        throw new Error("Cannot find configuration for redis server " + serverName);
    }
};

RedisConnectionManager.prototype.shutDown = function(callback) {
    var count = Object.keys(this._servers);
    
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
        console.log("Shutting down redis connection, key: " + keyName);
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