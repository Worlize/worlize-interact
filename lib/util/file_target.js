var util = require('util');
var fs = require('fs');
var LogTargetBase = require("./log_target_base");

function FileTarget() {
    LogTargetBase.call(this);
    this.logFilePath = null;
    this.fileMode = 0644;
    this.writeStream = null;
};

util.inherits(FileTarget, LogTargetBase);

FileTarget.prototype.close = function() {
    if (this.writeStream && this.writeStream.writable) {
        this.writeStream.end();
    }
};

FileTarget.prototype.write = function(string) {
    if (!this.writeStream || !this.writeStream.writable) {
        if (this.logFilePath === null) {
            throw new Error("You must specify a logFilePath for FileTarget");
        }
        this.writeStream = fs.createWriteStream(
            this.logFilePath,
            {
                flags: "a",
                encoding: 'utf8',
                mode: this.fileMode
            }
        );
        this.writeStream.on('error', function(err) {
            console.log("Error while writing to log file " + this.logFilePath + ":\n" + err);
        });
    }
    this.writeStream.write(string + "\n");
};

module.exports = FileTarget;