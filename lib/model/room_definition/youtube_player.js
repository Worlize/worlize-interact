var guidRegexp = /^[\da-fA-F]{8}-[\da-fA-F]{4}-[\da-fA-F]{4}-[\da-fA-F]{4}-[\da-fA-F]{12}$/;
var uuid = require('node-uuid');

function YouTubePlayer(data) {
    this.type = 'hotspot';
    if (data) {
        this.guid = data.guid;
        this.x = data.x;
        this.y = data.y;
        this.width = data.width;
        this.height = data.height;
        this.data = data.data;
    }
    else {
        this.x = 255;
        this.y = 110;
        this.width = 500;
        this.height = 281;
        this.data = {};
    }
    if (!this.guid) {
        this.guid = uuid.v1();
    }
};

YouTubePlayer.prototype.move = function(x, y) {
    if (typeof(x) !== 'number' || typeof(y) !== 'number') {
        throw new Error("x and y coordinates must be provided as numbers.");
    }
    this.x = parseInt(x);
    this.y = parseInt(y);
};

YouTubePlayer.prototype.setSize = function(width, height) {
    if (typeof(width) !== 'number' || typeof(height) !== 'number') {
        throw new Error("width and height dimensions must be provided as numbers.");
    }
    this.width = parseInt(width);
    this.height = parseInt(height);
}

YouTubePlayer.prototype.toJSON = function() {
    return {
        type: 'youtubePlayer',
        guid: this.guid,
        x: this.x,
        y: this.y,
        width: this.width,
        height: this.height,
        data: this.data
    };
};

module.exports = YouTubePlayer;