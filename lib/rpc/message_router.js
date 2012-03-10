var Log            = require('../util/log'),
    fs             = require('fs'),
    MessageEncoder = require('./message_encoder');
    
var logger = Log.getLogger("rpc.MessageRouter");

var MessageRouter = function(chatserver, handlerDirectory, verifyClientMessages) {
    this.verifyClientMessages = verifyClientMessages;
    this.chatserver = chatserver;
    this._handlers = {};
    this._binaryHandlers = {};
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
        delete this._binaryHandlers[messageName];
    },
    removeAllHandlers: function() {
        logger.debug2("Removing all message handlers.");
        this._handlers = {};
        this._binaryHandlers = {};
    },
    addHandler: function(messageName, handlerClass) {
        if (handlerClass.binary) {
            this._binaryHandlers[messageName] = handlerClass;
            var b = new Buffer(4);
            b.writeUInt32BE(handlerClass.messageId, 0);
            logger.debug2("Added binary message handler 0x" + handlerClass.messageId.toString(16) + " - " + b.toString('ascii'));
        }
        else {
            this._handlers[messageName] = handlerClass;
            logger.debug2("Added message handler " + handlerClass.messageId);
        }
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
            handler.receive(message, user);
        }
        else {
            /* Special Cases */
            throw new Error("Unhandled Message Type '" + message.msg + "'");
        }
    },
    routeBinaryMessage: function(buffer, user) {
        if (buffer.length <= 4) {
            throw new Error("Message does not include required 32-bit message type");
        }
        var messageId = buffer.readUInt32BE(0);
        var MessageClass = this._binaryHandlers[messageId];
        if (MessageClass && (!this.verifyClientMessages || MessageClass.acceptFromClient)) {
            var handler = new MessageClass(this.chatserver);
            handler.receive(buffer, user);
        }
        else {
            throw new Error("Unhandled Message Type 0x" + messageId.toString(16));
        }
    }
};

module.exports = MessageRouter;