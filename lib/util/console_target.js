function ConsoleTarget() {
    this.logTime = true;
    this.logIdentifier = true;
    this.logSeverity = true;
    this.logNotation = true;
    this.logLevel = 4;
}

var logLevels = [
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

ConsoleTarget.prototype.log = function(time, identifier, severity, text, notation) {
    if (severity < this.logLevel) { return; }
    var parts = [];
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
    console.log(parts.join(' - '));
};

module.exports = ConsoleTarget;