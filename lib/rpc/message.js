var util = require('util'),
    events = require('events'),
    Log = require('../util/log');
    
var logger = Log.getLogger('rpc.Message');

var Message = function(chatserver) {
   this.chatserver = chatserver;
};
util.inherits(Message, events.EventEmitter);

Message.messageId = "[message-base-class]";

Message.prototype.receive = function() {
   throw new Error("Implementation of Message#read not provided.");
};
Message.prototype.send = function() {
   throw new Error("Implementation of Message#send not provided.");       
};
Message.prototype.log = function(message) {
    logger.info(this.constructor.messageId + ": " + message);
};

module.exports = Message;