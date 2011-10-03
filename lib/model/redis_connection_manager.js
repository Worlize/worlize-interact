var sys = require('sys'),
    serverConfig = require('../config'),
    redis = require('redis');

var RedisConnectionManager = function() {
    this.config = serverConfig.redisServers;
    this._servers = {};
};
RedisConnectionManager.prototype.getClient = function(serverName) {
    var s = this;
    if (this._servers[serverName]) {
        return this._servers[serverName];
    }
    else {
        var c = this.config[serverName];
        if (c) {
            if (serverConfig.log.redisConnection) {
                console.log("Connecting to redis server '" + serverName + "'");
            }

            var client = this._servers[serverName] = redis.createClient(
                c.port,
                c.host
            );

            client.select(c.db);

            if (serverConfig.log.redisConnection) {
                client.on('ready', function() {
                    console.log("Connected to redis server '" + serverName + "'");
                });
                client.on('end', function() {
                    console.log("Redis server '" + serverName + "' disconnected");
                    delete s._servers[serverName];
                });
            }

            client.addListener('error', function() {
                console.log("FATAL: Cannot establish connection to redis server '" + serverName + "'");
                
            });

            return client;
        }
        else {
            throw new Error("Cannot find configuration for redis server " + serverName);
        }
    }
};

RedisConnectionManager.getInstance = function() {
    if (RedisConnectionManager.instance) {
        return RedisConnectionManager.instance;
    }
    return RedisConnectionManager.instance = new RedisConnectionManager();
}

module.exports = RedisConnectionManager.getInstance();