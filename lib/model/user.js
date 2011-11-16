var sys = require('sys'),
    events = require('events'), 
    redisConnectionManager = require('./redis_connection_manager'),
    MessageEncoder = require('../rpc/message_encoder'),
    UserState = require('./user_state'),
    Log = require('../util/log');
    
var logger = Log.getLogger('model.User');
    
var User = function(guid, userName) {
    this.guid = guid;
    this.userName = userName;
    this.logNotation = null;
    this.session = null; // a reference to the Session model object
    this.connection = null; // a reference to the WebSocketConnection
    this.currentRoom = null; // a reference to the current Room model object
    this.position = [ 0, 0 ];
    this.state = null;
};

User.load = function(guid, userName, callback) {
    var user = new User(guid, userName);
    user.loadData(callback);
};

User.prototype.leaveRoom = function() {
    if (this.currentRoom) {
        this.currentRoom.userLeave(this);
    }
};

User.prototype.loadData = function(callback) {
    var self = this;
    UserState.load(guid, function(err, result) {
        if (err) {
            callback(err);
            return;
        }
        self.state = result;
        callback(null, self);
    });
};

User.prototype.destroy = function() {
    if (this.currentRoom) {
        logger.debug2("User.destroy() username: " + this.username, this.logNotation);
        this.currentRoom.userLeave(this.guid);
    }
};

User.prototype.sendMessage = function(message) {
    if (this.connection.connected) {
        message.send(this);
    }
};

module.exports = User;