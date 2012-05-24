var guidRegexp = /^[\da-fA-F]{8}-[\da-fA-F]{4}-[\da-fA-F]{4}-[\da-fA-F]{4}-[\da-fA-F]{12}$/;
var uuid = require('node-uuid');

function AppInstance(data) {
    this.type = 'app';
    if (data) {
        this.guid = data.guid;
        this.appName = data.app_name;
        this.x = data.x;
        this.y = data.y;
        this.width = data.width;
        this.height = data.height;
        this.dest = data.dest;
        this.appUrl = data.app_url;
        this.appGuid = data.app_guid;
        this.testMode = data.test_mode;
        this.smallIconUrl = data.small_icon;
        this.iconUrl = data.icon;
        this.creator = data.creator;
        this.config = data.config;
    }
    else {
        this.guid = null;
        this.appName = "Untitled App";
        this.x = null;
        this.y = null;
        this.width = null;
        this.height = null;
        this.dest = null;
        this.appUrl = null;
        this.appGuid = null;
        this.testMode = null;
        this.smallIconUrl = null;
        this.iconUrl = null;
        this.creator = null;
        this.config = {};
    }
    if (this.guid === null) {
        this.guid = uuid.v1();
    }
};

AppInstance.prototype.move = function(x,y) {
    if (typeof(x) !== 'number' || typeof(y) !== 'number') {
        throw new Error("x and y coordinates must be provided as numbers.");
    }
    this.x = parseInt(x);
    this.y = parseInt(y);
};

AppInstance.prototype.setDest = function(dest) {
    if (!dest.match(guidRegexp)) {
        throw new Error("Destination must be a valid GUID")
    }
    this.dest = dest;
};

AppInstance.prototype.clone = function() {
    return new AppInstance(this.toJSON());
};

AppInstance.prototype.toJSON = function() {
    return {
        type: 'app',
        guid: this.guid,
        app_name: this.appName,
        x: this.x,
        y: this.y,
        width: this.width,
        height: this.height,
        dest: this.dest,
        creator_guid: this.creator,
        config: this.config,
        app_url: this.appUrl,
        app_guid: this.appGuid,
        test_mode: this.testMode,
        small_icon: this.smallIconUrl,
        icon: this.iconUrl
    };
};

AppInstance.prototype.toSavableData = function() {
    var data = this.toJSON();
    delete data['config'];
    return data;
}

module.exports = AppInstance;