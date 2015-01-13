var util = require('util'),
    events = require('events'),
    mysql = require('mysql'),
    config = require('../config'),
    Log = require('../util/log');

var logger = Log.getLogger('model.Prop');

var s3Bucket = config['amazonConfig']['props_bucket'];

var mysqlClient = mysql.createClient(config.mysqlConfig);
mysqlClient.on('error', function(err) {
    logger.error("action=mysql_error Unhandled MySQL Error: " + err.toString());
});

function Prop() {
    this.guid = null;
    this.creatorGuid = null;
    this.name = null;
    this.filename = null;
    this.imageURL = null;
    this.mediumURL = null;
    this.thumbnailURL = null;
    this.ready = false;
    this.refCount = 0;
}

util.inherits(Prop, events.EventEmitter);

var loadingPropsByGuid = {};
var props = {};

Prop.prototype.getSerializableHash = function() {
    return {
        guid: this.guid,
        name: this.name,
        image: this.imageURL,
        thumbnail: this.thumbnailURL,
        medium: this.mediumURL,
        creatorGuid: this.creatorGuid
    };
};

Prop.load = function(guid, callback) {
    var prop;
    
    if (guid in props) {
        prop = props[guid];
        process.nextTick(function() { callback(null, prop); });
        return;
    }
    
    if (guid in loadingPropsByGuid) {
        prop = loadingPropsByGuid[guid];
    }
    else {
        prop = loadingPropsByGuid[guid] = new Prop();
        prop.guid = guid;
        process.nextTick(function() { prop.load(); })
    }
    
    prop.on('ready', readyCallback);
    prop.on('loadError', loadErrorCallback);
    
    function loadErrorCallback(err) {
        delete loadingPropsByGuid[guid];
        prop.removeListener('ready', readyCallback);
        prop.removeListener('loadError', loadErrorCallback);
        callback(err);
    }
    
    function readyCallback() {
        delete loadingPropsByGuid[guid];
        prop.removeListener('ready', readyCallback);
        prop.removeListener('loadError', loadErrorCallback);
        callback(null, prop);
    }
};

Prop.addToCache = function(prop) {
    logger.debug2("Adding prop " + prop.guid + " to the pool.");
    props[prop.guid] = prop;
};

Prop.removeFromCache = function(prop) {
    logger.debug2("Removing prop " + prop.guid + " from pool.");
    delete props[prop.guid];
};

Prop.prototype.load = function() {
    if (this.ready) { return; }
    
    var self = this;
    
    var qs = "SELECT * FROM props WHERE guid = ? LIMIT 1";
    var params = [ this.guid ];
    if (logger.shouldLogLevel('debug3')) {
        logger.debug3("MySQL Query:\n" + qs + "\nQuery Params:\n" + JSON.stringify(params));
    }
    mysqlClient.query(qs, params, function(err, results, fields) {
        if (err) {
            logger.error("action=mysql_error prop_guid=" + self.guid + " Unable to load prop from database: " + err.toString());
            self.emit('loadError', err);
            return;
        }
        
        var record = results[0];
        if (!record) {
            logger.error("action=prop_not_found prop_guid=" + self.guid);
            self.emit('loadError', new Error('Prop ' + self.guid + ' not found.'));
            return;
        }
        
        self.name = record['name'];
        self.filename = record['image'];
        self.thumbnailURL = "https://s3.amazonaws.com/" + s3Bucket + "/" + self.guid + "/thumb_" + self.filename;
        self.mediumURL = "https://s3.amazonaws.com/" + s3Bucket + "/" + self.guid + "/medium_" + self.filename;
        self.imageURL = "https://s3.amazonaws.com/" + s3Bucket + "/" + self.guid + "/" + self.filename;
        self.ready = true;
        self.emit('ready');
    });
};

// We have to perform manual reference counting to be able to release
// the object from the pool when it's no longer in use.
Prop.prototype.retain = function() {
    this.refCount ++;
    if (this.refCount === 1) {
        Prop.addToCache(this);
    }
};

Prop.prototype.release = function() {
    this.refCount --;
    if (this.refCount <= 0) {
        Prop.removeFromCache(this);
    }
};

module.exports = Prop;