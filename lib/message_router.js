var kiwi = require('kiwi'),
    sys = require('sys'),
    Class = kiwi.require('class').Class;

var HandshakeMessage = require('./rpc/messages/handshake').HandshakeMessage;
    SayMessage = require('./rpc/messages/say').SayMessage

exports.MessageRouter = new Class({
    constructor: function(chatserver, defaultHandlers) {
        this.chatserver = chatserver;
        this._handlers = {
            'handshake': HandshakeMessage,
            'say': SayMessage
        };
    },
    addHandler: function(messageName, handlerClass) {
        this._handlers[messageName] = handlerClass;
    },
    processMessage: function(message, client) {
        var result;
        try {
            result = JSON.parse(message);
        }
        catch(error) {
            sys.log("Client " + client.sessionId + ": Unparsable message: " + message + "\nError: " + error);
            // TODO: Disconnect misbehaving clients.
        }

        if (result && result.msg) {
            // We have a usable message, route it!
            this.routeMessage(result, client);
        }
        else {
            sys.log("Client " + client.sessionId + ": Unrecognized JSON structure.  Cannot find 'msg' key.");
            // TODO: Disconnect misbehaving clients.
        }
    },
    routeMessage: function(message, client) {
        var HandlerClass = this._handlers[message.msg];
        if (HandlerClass) {
            var handler = new HandlerClass(this.chatserver);
            handler.read(message, client);
        }
        else {
            /* Special Cases */
            switch (message.msg) {
                default:
                    sys.log("Client " + client.sessionId + ": Unhandled Message Type '" + message.msg + "'");
                    break;
            }
        }
    }
    
});