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
            var c = this.config[serverName];
            if (c) {
                if (serverConfig.log.redisConnection) {
                    sys.log("Connecting to redis server " + serverName)
                }

                var client = this._servers[serverName] = Redis.createClient(
                    c.port,
                    c.host
                );

                if (serverConfig.log.redisConnection) {
                    client.addListener('reconnecting', function() {
                        sys.log("About to reconnect to redis server '" + serverName + "'");
                    });
                    client.addListener('reconnected', function() {
                        sys.log("Reconnected to redis server '" + serverName + "'");
                    });
                    client.addListener('connected', function() {
                        sys.log("Connected to redis server '" + serverName + "'");
                    });
                }

                client.addListener('noconnection', function() {
                    sys.log("FATAL: Cannot establish connection to redis server '" + serverName + "'");
                });

                client.select(c.db);

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

module.exports = RedisConnectionManager.getInstance();