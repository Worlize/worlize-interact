var sys = require('sys'),
    events = require('events');
    
var User = function(guid, userName) {
    this.guid = guid;
    this.userName = userName;
    this.session = null;
    this.currentRoom = null;
    this.position = [ 0, 0 ];
    this.face = Math.floor(Math.random()*8);
    this.avatar = null;
};

sys.inherits(User, events.EventEmitter);

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