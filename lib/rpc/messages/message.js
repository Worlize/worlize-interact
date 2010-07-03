var sys = require('sys'),
    kiwi = require('kiwi'),
    events = require('events'),
    Class = kiwi.require('class').Class;

var Message = new Class({
   constructor: function(chatserver) {
       this.chatserver = chatserver;
   },
   read: function() {
       throw new Error("Implementation of Message#read not provided.");
   },
   send: function() {
       throw new Error("Implementation of Message#send not provided.");       
   }
});

sys.inherits(Message, events.EventEmitter);

exports.Message = Message;