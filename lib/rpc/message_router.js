var kiwi = require('kiwi'),
    sys = require('sys'),
    Class = kiwi.require('class').Class;

exports.MessageRouter = new Class({
    constructor: function(chatserver, defaultHandlers) {
        this.chatserver = chatserver;
        this._handlers = {};
        if (defaultHandlers) {
            this.addHandlers(defaultHandlers);
        }
    },
    removeHandler: function(messageName) {
        delete this._handlers[messageName];
    },
    removeAllHandlers: function() {
        this._handlers = {};
    },
    addHandler: function(messageName, handlerClass) {
        this._handlers[messageName] = handlerClass;
    },
    addHandlers: function(handlerList) {
        for (var handlerName in handlerList) {
            this.addHandler(handlerName, handlerList[handlerName]);
        }
    },
    decodeMessage: function(message) {
        if (message && message.msg) {
            // We have a usable message!
            return message;
        }
        else {
            throw new Error("Unrecognized message format.  Cannot find 'msg' key.");
            // TODO: Disconnect misbehaving clients.
        }
    },
    routeMessage: function(message) {
        var MessageClass = this._handlers[message.msg];
        if (MessageClass) {
            var handler = new MessageClass(this.chatserver);
            handler.receive.apply(handler, arguments);
        }
        else {
            /* Special Cases */
            throw new Error("Unhandled Message Type '" + message.msg + "'");
        }
    }
    
});