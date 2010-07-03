var sys = require('sys'),
    kiwi = require('kiwi'),
    Class = kiwi.require('class').Class,
    serverConfig = require('../config').Config,
    Redis = require('../vendor/redis-node-client/lib/redis-client');


var RedisConnectionManager = new Class({
    constructor: function() {
        this.config = serverConfig.redisServers;
        this._servers = {};
    },
    getClient: function(serverName) {
        if (this._servers[serverName]) {
            return this._servers[serverName];
        }
        else {
            var serverConfig = this.config[serverName];
            if (serverConfig) {
                sys.log("Connecting to redis server " + serverName)
                var client = this._servers[serverName] = Redis.createClient(
                    serverConfig.port,
                    serverConfig.host
                );
                client.select(serverConfig.db);
                return client;
            }
            else {
                throw new Error("Cannot find configuration for redis server " + serverName);
            }
        }
    }
});

RedisConnectionManager.getInstance = function() {
    if (RedisConnectionManager.instance) {
        return RedisConnectionManager.instance;
    }
    return RedisConnectionManager.instance = new RedisConnectionManager();
}

exports.connectionManager = RedisConnectionManager.getInstance();