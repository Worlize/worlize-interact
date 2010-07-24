var sys = require('sys'),
    kiwi = require('kiwi'),
    User = require('./user');
    
var UserManager = function(chatserver) {
    this.chatserver = chatserver;
    this.users = {};
};

UserManager.prototype = {
    initUser: function(guid, userName) {
        return this.users[guid] = new User(guid, userName);
    },
    getUser: function(guid, userName) {
        var user = this.users[guid];
        if (!user) {
            user = this.initUser(guid, userName);
        }
        return user;
    },
    removeUser: function(guid) {
        var user = this.users[guid];
        if (user) {
            user.destroy();
            delete this.users[guid];
        }
    }
};

module.exports = UserManager;