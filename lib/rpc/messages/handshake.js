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
        this.client = client;
        this._getSessionData(this.guid);
    },
    _getSessionData: function(session_guid) {
        this.session = Session.load(session_guid);
        this.session.addListener('loaded', this._sessionLoaded.bind(this));
        this.session.addListener('loadError', this._sessionLoadError.bind(this));
    },
    _sessionLoaded: function(session) {
        sys.log("Have session data:\n" + sys.inspect(this.session));
    },
    _sessionLoadError: function(error) {
        sys.log("Unable to load session data for guid " + this.guid + ": \n" + err);
    }
});

exports.HandshakeMessage = HandshakeMessage;
