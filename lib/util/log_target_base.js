function LogTargetBase() {
    this.logTime = true;
    this.logIdentifier = true;
    this.logSeverity = true;
    this.logNotation = true;
    this.logLevel = 4;
    this.logInstanceId = false;
    this.instanceId = "***";
}

var logLevels = LogTargetBase.logLevels = [
    "[DEBUG3]",
    null,
    "[DEBUG2]",
    null,
    "[DEBUG]",
    null,
    "[INFO]",
    null,
    "[WARN]",
    null,
    "[ERROR]",
    null,
    "[FATAL]"
];

LogTargetBase.prototype.log = function(time, identifier, severity, text, notation) {
    if (severity < this.logLevel) { return; }
    this.write(this.format(time, identifier, severity, text, notation));
};

LogTargetBase.prototype.format = function(time, identifier, severity, text, notation) {
    var parts = [];
    if (this.logInstanceId) {
        parts.push(this.instanceId);
    }
    if (this.logTime) {
        parts.push(time.toISOString());
    }
    if (this.logSeverity) {
        parts.push(logLevels[severity]);
    }
    if (this.logNotation) {
        if (notation) {
            var notationPairs = [];
            for (var key in notation) {
                notationPairs.push(key + "=" + notation[key]);
            }
            parts.push(notationPairs.join(', '));
        }
        else {
            parts.push("***")
        }
    }
    if (this.logIdentifier) {
        parts.push("class=" + identifier);
    }
    parts.push(text);
    return parts.join(' - ');
};

LogTargetBase.write = function(string) {
    throw new Error("write() must be handled by a subclass of LogTargetBase.");
};

module.exports = LogTargetBase;