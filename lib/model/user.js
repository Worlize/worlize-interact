var sys = require('sys'),
    events = require('events'), 
    UserState = require('./user_state');
    
var User = function(guid, userName) {
    var self = this;

    this.guid = guid;
    this.userName = userName;
    this.session = null;
    this.currentRoom = null;
    this.position = [ 0, 0 ];

    this.state = new UserState(this.guid);
    this.state.on('ready', function() {
        self.emit('ready');
    });
};
sys.inherits(User, events.EventEmitter);


User.prototype.loadData = function() {
    this.state.loadData();  
};
User.prototype.destroy = function() {
    if (this.currentRoom) {
        sys.log("Exiting current room");
        this.currentRoom.userLeave(this.guid);
    }
    else {
        sys.log("No current room defined for user.");
    }
};
User.prototype.sendMessage = function(message) {
    message.send(this.session.client);
};

module.exports = User;