function ConsoleTarget() {
    this.logTime = true;
    this.logIdentifier = true;
    this.logSeverity = true;
    this.logLevel = 4;
}

var logLevels = [
    "[DEBUG3]",
    null,
    "[DEBUG2]",
    null,
    "[DEBUG ]",
    null,
    "[INFO  ]",
    null,
    "[WARN  ]",
    null,
    "[ERROR ]",
    null,
    "[FATAL ]"
];

ConsoleTarget.prototype.log = function(time, identifier, severity, text) {
    if (severity < this.logLevel) { return; }
    var parts = [];
    if (this.logTime) {
        parts.push(time.toISOString());
    }
    if (this.logSeverity) {
        parts.push(logLevels[severity]);
    }
    if (this.logIdentifier) {
        parts.push(identifier);
    }
    var preamble = parts.join(" - ");
    console.log(preamble, text);
};

module.exports = ConsoleTarget;