var util = require('util'),
    events = require('events'),
    mysql = require('mysql'),
    config = require('../mysql_config'),
    Log = require('../util/log');

var logger = Log.getLogger('model.Prop');

var s3Bucket = config['amazonConfig']['props_bucket'];

var mysqlClient = mysql.createClient(config.mysqlConfig);
mysqlClient.on('error', function(err) {
    logger.error("action=mysql_error Unhandled MySQL Error: " + err.toString());
});

function Prop() {
    this.guid = null;
    this.name = null;
    this.filename = null;
    this.imageUrl = null;
    this.thumbnailUrl = null;
    this.ready = false;
    this.refCount = 0;
}

util.inherits(Prop, events.EventEmitter);

var loadingPropsByGuid = {};
var props = {};
var refCount = {};

Prop.load = function(guid, callback) {
    var prop;
    
    if (guid in props) {
        prop = props[guid];
        callback(null, prop);
        return;
    }
    
    if (guid in loadingPropsByGuid) {
        prop = loadingPropsByGuid[guid];
        prop.on('ready', function() {
            callback(null, prop);
        });
        return;
    }
    
    prop = loadingPropsByGuid[guid] = new Prop();
    refCount[guid] = 0;
    prop.guid = guid;
    prop.on('ready', function() {
        props[guid] = prop;
        delete loadingPropsByGuid[guid];
        callback(null, prop);
    });
    prop.on('loadError', function(err) {
        delete loadingPropsByGuid[guid];
        callback(err);
    });
    prop.load();
    return;
};

Prop.removeFromCache = function(prop) {
    delete props[prop.guid];
};

Prop.prototype.load = function() {
    if (this.ready) { return; }
    
    var self = this;
    
    var qs = "SELECT * FROM props WHERE guid = ? LIMIT 1";
    var params = [ this.guid ];
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
        self.thumbnailUrl = "https://s3.amazonaws.com/" + s3Bucket + "/" + self.guid + "/thumb_" + self.filename;
        self.imageUrl = "https://s3.amazonaws.com/" + s3Bucket + "/" + self.guid + "/" + self.filename;
        self.ready = true;
        self.emit('ready');
    });
};

// We have to perform manual reference counting to be able to release
// the object from the pool when it's no longer in use.
Prop.prototype.retain = function() {
    this.refCount ++;
};

Prop.prototype.release = function() {
    this.refCount --;
    if (this.refCount <= 0) {
        Prop.removeFromCache(this);
    }
};
