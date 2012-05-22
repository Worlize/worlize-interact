var guidRegexp = /^[\da-fA-F]{8}-[\da-fA-F]{4}-[\da-fA-F]{4}-[\da-fA-F]{4}-[\da-fA-F]{12}$/;
var uuid = require('node-uuid');

function InWorldObjectInstance(data) {
    this.type = 'object';
    if (data) {
        this.guid = data.guid;
        this.x = data.x;
        this.y = data.y;
        this.dest = data.dest;
        this.creator = data.creator;
        this.fullsizeUrl = data.fullsize_url;
        this.thumbnailUrl = data.thumbnail_url;
        this.objectGuid = data.object_guid;
    }
    else {
        this.x = null;
        this.y = null;
        this.points = null;
        this.dest = null;
        this.creator = null;
        this.fullsizeUrl = null;
        this.thumbnailUrl = null;
        this.objectGuid = null;
    }
};

InWorldObjectInstance.prototype.move = function(x,y) {
    if (typeof(x) !== 'number' || typeof(y) !== 'number') {
        throw new Error("x and y coordinates must be provided as numbers.");
    }
    this.x = parseInt(x);
    this.y = parseInt(y);
};

InWorldObjectInstance.prototype.setDest = function(dest) {
    if (!dest.match(guidRegexp)) {
        throw new Error("Destination must be a valid GUID")
    }
    this.dest = dest;
};

InWorldObjectInstance.prototype.clone = function() {
    return new InWorldObjectInstance(this.toJSON());
};

InWorldObjectInstance.prototype.toJSON = function() {
    return {
        type: 'object',
        guid: this.guid,
        x: this.x,
        y: this.y,
        dest: this.dest,
        creator: this.creator,
        fullsize_url: this.fullsizeUrl,
        thumbnail_url: this.thumbnailUrl,
        object_guid: this.objectGuid
    };
};

module.exports = InWorldObjectInstance;