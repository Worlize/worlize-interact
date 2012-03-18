var util = require('util'),
    events = require('events'),
    config = require('../config'),
    StateHistoryList = require('./state_history_list'),
    Log = require('../util/log');
    
var logger = Log.getLogger('model.RoomAppData');


var RoomAppData = function(appGuid, room) {
    if (!appGuid) {
        throw new Error("You must specify an app guid to create a new RoomAppData instance");
    }
    if (!room) {
        throw new Error("You must provide a room to create a new RoomAppData instance");
    }
    this.appGuid = appGuid;
    this.room = room;
    
    this.stateHistoryList = new StateHistoryList(appGuid);
};

RoomAppData.prototype.stateHistoryPush = function(userGuid, data) {
    this.stateHistoryList.push(userGuid, data);
    if (this.stateHistoryList.length > 0xFFFF) {
        this.stateHistoryList.shift();
    }
};