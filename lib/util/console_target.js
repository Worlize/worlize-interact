var util = require('util');
var LogTargetBase = require("./log_target_base");

function ConsoleTarget() {
    LogTargetBase.call(this);
};

util.inherits(ConsoleTarget, LogTargetBase);

ConsoleTarget.prototype.write = console.log;

module.exports = ConsoleTarget;