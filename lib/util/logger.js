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

Logger.prototype.log = function(severity, text, notation) {
    this.emit('log', new Date(), this.identifier, severity, text, notation);
};

Logger.prototype.debug3 = function(text, notation) {
    this.log(DEBUG3, text, notation);
};

Logger.prototype.debug2 = function(text, notation) {
    this.log(DEBUG2, text, notation);
};

Logger.prototype.debug = function(text, notation) {
    this.log(DEBUG, text, notation);
};

Logger.prototype.info = function(text, notation) {
    this.log(INFO, text, notation);
};

Logger.prototype.warn = function(text, notation) {
    this.log(WARN, text, notation);
};

Logger.prototype.error = function(text, notation) {
    this.log(ERROR, text, notation);
};

Logger.prototype.fatal = function(text, notation) {
    this.log(FATAL, text, notation);
};

module.exports = Logger;