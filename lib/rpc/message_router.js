var sys            = require('sys'),
    fs             = require('fs'),
    MessageEncoder = require('./message_encoder');

var MessageRouter = function(chatserver, handlerDirectory, verifyClientMessages) {
    this.verifyClientMessages = verifyClientMessages;
    this.chatserver = chatserver;
    this._handlers = {};
    this.addHandlersInDirectory(handlerDirectory);
};

MessageRouter.prototype = {
    addHandlersInDirectory: function(directory) {
        var self = this;
        fs.readdirSync(directory).forEach(function(filename) {
            if (/^\._/.test(filename)) {
                // don't load text editor temp files.
                return;
            }
            var handler = require(directory + '/' + filename)
            self._handlers[handler.messageId] = handler;
        });
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
    decodeMessage: function(rawMessage) {
        var message;
        message = MessageEncoder.decode(rawMessage);
        
        if (message && message.msg) {
            // We have a usable message!
            return message;
        }
        else {
            throw new Error("Unrecognized message format.  Cannot find 'msg' key.");
            // TODO: Disconnect misbehaving clients.
        }
    },
    routeMessage: function(message, user) {
        var MessageClass = this._handlers[message.msg];
        if (MessageClass && (!this.verifyClientMessages || MessageClass.acceptFromClient)) {
            var handler = new MessageClass(this.chatserver);
            handler.receive.apply(handler, arguments);
        }
        else {
            /* Special Cases */
            throw new Error("Unhandled Message Type '" + message.msg + "'");
        }
    }
};

module.exports = MessageRouter;