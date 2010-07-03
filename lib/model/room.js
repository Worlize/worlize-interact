var sys = require('sys'),
    kiwi = require('kiwi'),
    Class = kiwi.require('class').Class,
    redisConnectionManager = require('./redis_connection_manager').connectionManager,
    redis = redisConnectionManager.getClient('roomDefinitions');

var Room = new Class({

    // name: null,
    // guid: null,
    // ready: null,
    // error: null,
    // worlzGuid: null,
    // chatServer: null,
    // users: null

    constructor: function(chatserver, guid) {
        if (!chatserver) {
            throw new Error("You must provide a chatserver instance.")
        }
        if (!guid) {
            throw new Error("You must provide a guid for the room.");
        }
        
        this.users = {};
        this.guid = guid;
        this.name = "Uninitialized Room";
        this.chatserver = chatserver;
        this.ready = false;
        this.error = false;
        redis.get('roomDefinition:' + guid, this._handleRoomDefinition.bind(this));
    },
    
    _handleRoomDefinitionResponse: function(err, data) {
        var definition;
        try {
            definition = JSON.parse(data);
        }
        catch (e) {
            this.error = true;
            this.ready = false;
            return;
        }
        this.name = definition.name;
        this.worlzGuid = definition.worlz_guid;
        this.ready = true;
        this.error = false;
        sys.log("Got room definition for " + this.name);
    }    
    
    
});
