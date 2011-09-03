var sys = require('sys'),
    events = require('events'), 
    MessageEncoder = require('../rpc/message_encoder'),
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

User.prototype.handlePubSubMessage = function(channel, message) {
    try {
        message = MessageEncoder.decode(message);
        this.session.client.send(MessageEncoder.encode(message));
    }
    catch (e) {
        console.log("Error while forwarding message to user from control channel: " + e);
    }
};
User.prototype.loadData = function() {
    this.state.loadData();  
};
User.prototype.destroy = function() {
    if (this.currentRoom) {
        console.log("Exiting current room");
        this.currentRoom.userLeave(this.guid);
    }
};
User.prototype.sendMessage = function(message) {
    if (this.session.client.connected) {
        message.send(this.session.client);
    }
};

module.exports = User;