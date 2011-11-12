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

Logger.prototype.log = function(severity, text, id) {
    this.emit('log', new Date(), this.identifier, severity, text, id);
};

Logger.prototype.debug3 = function(text, id) {
    this.log(DEBUG3, text, id);
};

Logger.prototype.debug2 = function(text, id) {
    this.log(DEBUG2, text, id);
};

Logger.prototype.debug = function(text, id) {
    this.log(DEBUG, text, id);
};

Logger.prototype.info = function(text, id) {
    this.log(INFO, text, id);
};

Logger.prototype.warn = function(text, id) {
    this.log(WARN, text, id);
};

Logger.prototype.error = function(text, id) {
    this.log(ERROR, text, id);
};

Logger.prototype.fatal = function(text, id) {
    this.log(FATAL, text, id);
};

module.exports = Logger;