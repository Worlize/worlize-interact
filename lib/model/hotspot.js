var guidRegexp = /^[\da-fA-F]{8}-[\da-fA-F]{4}-[\da-fA-F]{4}-[\da-fA-F]{4}-[\da-fA-F]{12}$/;
var uuid = require('node-uuid');

function Hotspot(data) {
    this.type = 'hotspot';
    if (data) {
        this.guid = data.guid;
        this.x = data.x;
        this.y = data.y;
        this.points = data.points;
        this.dest = data.dest;
    }
    else {
        this.x = null;
        this.y = null;
        this.points = null;
        this.dest = null;
    }
    if (!this.guid) {
        this.guid = uuid.v1();
    }
};

Hotspot.prototype.move = function(x,y) {
    if (typeof(x) !== 'number' || typeof(y) !== 'number') {
        throw new Error("x and y coordinates must be provided as numbers.");
    }
    this.x = parseInt(x);
    this.y = parseInt(y);
};

Hotspot.prototype.setDest = function(dest) {
    if (!dest.match(guidRegexp)) {
        throw new Error("Destination must be a valid GUID")
    }
    this.dest = dest;
};

Hotspot.prototype.setPoints = function(points) {
    if (!Array.isArray(points)) {
        throw new Error("points must be provided as an array.");
    }
    this.points = points;
};

Hotspot.prototype.toJSON = function() {
    return {
        type: 'hotspot',
        guid: this.guid,
        x: this.x,
        y: this.y,
        points: this.points,
        dest: this.dest
    };
};

module.exports = Hotspot;