var sys = require('sys'),
    kiwi = require('kiwi'),
    Class = kiwi.require('class').Class,
    Message = require('./message').Message,
    Session = require('../../model/session').Session;

kiwi.require('ext'); /* Provides Function#bind */
    
var HandshakeMessage = new Message.extend({
    constructor: function(chatserver) {
        Message.call(this, chatserver);
        this.session = null;
        this.guid = null;
    },
    read: function(message, client) {
        this.guid = message.data.session_guid;
        this._getSessionData(this.guid);
    },
    _getSessionData: function(session_guid) {
        this.session = new Session(session_guid);
        this.session.load(this._handleSessionData.bind(this));
    },
    _handleSessionData: function(err, data) {
        if (err) {
            sys.puts("Unable to load session data for guid " + this.guid + ": \n" + sys.inspect(err));
        }
        else {
            sys.puts("Have session data!");
            sys.puts(sys.inspect(this.session));
        }
    }
});

exports.HandshakeMessage = HandshakeMessage;
