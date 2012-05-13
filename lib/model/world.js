

function World() {
    this.name = "";
    this.guid = null;
    this.moderationList = null;
};

World.prototype.load = function(guid, callback) {
    callback(null); // no-op for now
};

module.exports = World;