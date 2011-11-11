var util = require('util');
var EventEmitter = require('events').EventEmitter;

function Logger(identifier) {
    EventEmitter.call(this);
    this.identifier = identifier;
}

util.inherits(Logger, EventEmitter);

const DEBUG3 = 0
const DEBUG2 = 2;
const DEBUG = 4;
const INFO = 6;
const WARN = 8;
const ERROR = 10;
const FATAL = 12;

Logger.prototype.log = function(severity, text) {
    this.emit('log', new Date(), this.identifier, severity, text);
};

Logger.prototype.debug3 = function(text) {
    this.log(DEBUG3, text);
};

Logger.prototype.debug2 = function(text) {
    this.log(DEBUG2, text);
};

Logger.prototype.debug = function(text) {
    this.log(DEBUG, text);
};

Logger.prototype.info = function(text) {
    this.log(INFO, text);
};

Logger.prototype.warn = function(text) {
    this.log(WARN, text);
};

Logger.prototype.error = function(text) {
    this.log(ERROR, text);
};

Logger.prototype.fatal = function(text) {
    this.log(FATAL, text);
};

module.exports = Logger;