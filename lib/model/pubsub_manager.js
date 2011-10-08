var redisConnectionManager = require('./redis_connection_manager');

function PubSubManager() {
    this.redisSubscribe = redisConnectionManager.getClient('pubsub', 'subscribe');
    this.redisPublish = redisConnectionManager.getClient('pubsub', 'publish');
    this.redisSubscribe.on('message', this.handleRedisMessage.bind(this));
    this.subscriptions = {};
}

PubSubManager.prototype.subscribe = function(channel, callback) {
    if (typeof(callback) !== 'function') {
        throw new Error("Supplied callback must be a function");
    }
    if (typeof(this.subscriptions[channel]) === 'undefined') {
        //console.log("Adding first subscription to channel " + channel);
        this.subscriptions[channel] = [callback];
        this.redisSubscribe.subscribe(channel);
    }
    else {
        //console.log("Adding additional subscription to channel " + channel);
        this.subscriptions[channel].push(callback);
    }
};

PubSubManager.prototype.unsubscribe = function(channel, callback) {
    var subscriptions = this.subscriptions[channel];
    if (subscriptions === null) { return; };
    if (typeof(callback) === 'undefined') {
        // remove all listeners if callback is not specified
        //console.log("Removing all subscriptions for channel " + channel);
        delete this.subscriptions[channel];
        this.redisSubscribe.unsubscribe(channel);
        return;
    }
    
    // Otherwise find the specific handler and remove it
    for (var i=0,len=subscriptions.length; i < len; i++) {
        if (subscriptions[i] === callback) {
            //console.log("Removed a callback from channel " + channel);
            subscriptions.splice(i, 1);
            break;
        }
    }
    if (subscriptions.length === 0) {
        //console.log("There are no more subscribers to channel " + channel);
        delete this.subscriptions[channel];
        this.redisSubscribe.unsubscribe(channel);
    }
};

PubSubManager.prototype.publish = function(channel, message) {
    //console.log("Publishing to channel " + channel);
    this.redisPublish.publish(channel, message);
};

PubSubManager.prototype.handleRedisMessage = function(channel, message) {
    //console.log("Received message on channel " + channel);
    var handlers = this.subscriptions[channel];
    if (handlers === null) {
        //console.log("Received unhandled Redis PubSub message on channel: " + channel);
        return;
    }
    for (var i=0,len=handlers.length; i < len; i++) {
        var callback = handlers[i];
        callback(message);
    }
};

module.exports = new PubSubManager();