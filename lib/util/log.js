var Logger = require('./logger');

var Log = {};
var targets = [];
var loggers = {};

Log.DEBUG3 = 0
Log.DEBUG2 = 2;
Log.DEBUG = 4;
Log.INFO = 6;
Log.WARN = 8;
Log.ERROR = 10;
Log.FATAL = 12;

Log.addTarget = function(target) {
    if (typeof(target.log) !== 'function') {
        throw new Error("Log target must implement the log() method.");
    }
    targets.push(target);
};

Log.getLogger = function(identifier) {
    if (loggers[identifier]) {
        return loggers[identifier];
    }
    var logger = loggers[identifier] = new Logger(identifier);
    logger.on('log', this.handleLogEvent);
    return logger;
};

Log.handleLogEvent = function(time, identifier, severity, text) {
    for (var i=0, len=targets.length; i < len; i ++) {
        targets[i].log(time, identifier, severity, text);
    }
};

module.exports = Log;