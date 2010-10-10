var sys = require('sys'),
    events = require('events');

var Message = function(chatserver) {
   this.chatserver = chatserver;
};
sys.inherits(Message, events.EventEmitter);

Message.prototype.receive = function() {
   throw new Error("Implementation of Message#read not provided.");
};
Message.prototype.send = function() {
   throw new Error("Implementation of Message#send not provided.");       
};

module.exports = Message;