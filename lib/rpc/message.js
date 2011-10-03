var sys = require('sys'),
    events = require('events');

var Message = function(chatserver) {
   this.chatserver = chatserver;
};
sys.inherits(Message, events.EventEmitter);

Message.messageId = "[message-base-class]";

Message.prototype.receive = function() {
   throw new Error("Implementation of Message#read not provided.");
};
Message.prototype.send = function() {
   throw new Error("Implementation of Message#send not provided.");       
};
Message.prototype.log = function(message) {
    console.log(this.constructor.messageId + ": " + message);
}

module.exports = Message;