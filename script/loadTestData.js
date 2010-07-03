var sys = require('sys'),
    kiwi = require('kiwi'),
    redisConnectionManager = require('../lib/model/redis_connection_manager').connectionManager,
    redis = redisConnectionManager.getClient('presence');
    
kiwi.require('ext');

redis.set("session:a1f85d84-7ed3-11df-9975-f716865e4541", JSON.stringify(
    {
      "session_guid": "a1f85d84-7ed3-11df-9975-f716865e4541",
      "user_guid": "8b48611a-b908-11de-9cd5-2db4fdd841bd",
      "screen_name": "Turtle",
      "room_guid": "cd2f8d86-d696-4574-8a29-dff29370582d",
      "worlz_guid": "29721446-7ed7-11df-9975-f716865e4541"
    } 
));

process.exit(0);
