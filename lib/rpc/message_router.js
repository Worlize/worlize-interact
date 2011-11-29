var Log            = require('../util/log'),
    fs             = require('fs'),
    MessageEncoder = require('./message_encoder');
    
var logger = Log.getLogger("rpc.MessageRouter");

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
            var handler = require(directory + '/' + filename);
            if (handler.messageId) {
                self.addHandler(handler.messageId, handler);
            }
            else {
                logger.warn("Message handler in " + directory + "/" + filename + " did not expose a messageId.  Skipping.");
            }
        });
    },
    removeHandler: function(messageName) {
        logger.debug2("Removing message handler " + messageName);
        delete this._handlers[messageName];
    },
    removeAllHandlers: function() {
        logger.debug2("Removing all message handlers.");
        this._handlers = {};
    },
    addHandler: function(messageName, handlerClass) {
        this._handlers[messageName] = handlerClass;
        logger.debug2("Added message handler " + handlerClass.messageId);
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