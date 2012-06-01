var guidRegexp = /^[\da-fA-F]{8}-[\da-fA-F]{4}-[\da-fA-F]{4}-[\da-fA-F]{4}-[\da-fA-F]{12}$/;
var uuid = require('node-uuid');
var _ = require('underscore');

function AppInstance(data) {
    this.type = 'app';
    if (data) {
        this.guid = data.guid ? data.guid : null;
        this.appName = data.app_name ? data.app_name : null;
        this.x = data.x ? data.x : null;
        this.y = data.y ? data.y : null;
        this.width = data.width ? data.width : null;
        this.height = data.height ? data.height : null;
        this.dest = data.dest ? data.dest : null;
        this.appUrl = data.app_url ? data.app_url : null;
        this.appGuid = data.app_guid ? data.app_guid : null;
        this.testMode = data.test_mode ? true : false;
        this.smallIconUrl = data.small_icon ? data.small_icon : null;
        this.mediumIconUrl = data.medium_icon ? data.medium_icon : null;
        this.iconUrl = data.icon ? data.icon : null;
        this.creator = data.creator ? data.creator : null;
        this.config = data.config ? data.config : null;
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
        this.mediumIconUrl = null;
        this.iconUrl = null;
        this.creator = null;
        this.config = {};
    }
    if (this.guid === null) {
        this.guid = uuid.v1();
    }
    if (this.iconUrl === null) {
        this.iconUrl = "/images/icons/app_icon/default.png";
    }
    if (this.smallIconUrl === null) {
        this.smallIconUrl = "/images/icons/app_icon/small_default.png";
    }
    if (this.mediumIconUrl === null) {
        this.mediumIconUrl = "/images/icons/app_icon/medium_default.png";
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
        small_icon: this.smallIconUrl,
        medium_icon: this.mediumIconUrl,
        icon: this.iconUrl,
        x: this.x,
        y: this.y,
        width: this.width,
        height: this.height,
        dest: this.dest,
        creator_guid: this.creator,
        config: this.config,
        app_url: this.appUrl,
        app_guid: this.appGuid,
        test_mode: this.testMode
    };
};

AppInstance.prototype.toSavableData = function() {
    var data = this.toJSON();
    delete data['config'];
    return data;
}

module.exports = AppInstance;