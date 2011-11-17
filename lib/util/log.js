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

Log.activeLogLevel = 12;

Log.addTarget = function(target) {
    if (typeof(target.log) !== 'function') {
        throw new Error("Log target must implement the log() method.");
    }
    targets.push(target);
    Log.refreshActiveLogLevel();
};

Log.getLogger = function(identifier) {
    if (loggers[identifier]) {
        return loggers[identifier];
    }
    var logger = loggers[identifier] = new Logger(identifier);
    logger.Log = Log;
    logger.on('log', this.handleLogEvent);
    return logger;
};

Log.handleLogEvent = function(time, identifier, severity, text, notation) {
    for (var i=0, len=targets.length; i < len; i ++) {
        targets[i].log(time, identifier, severity, text, notation);
    }
};

Log.refreshActiveLogLevel = function() {
    this.activeLogLevel = 12;
    for (var i=0,len=targets.length; i < len; i++) {
        var target = targets[i];
        this.activeLogLevel = Math.min(this.activeLogLevel, target.logLevel);
    }
};

Log.shouldLogLevel = function(logLevel) {
    return (this.activeLogLevel <= logLevel);
};

module.exports = Log;