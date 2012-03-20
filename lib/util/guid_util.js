module.exports = {};

const GUID_REGEXP = /^([\da-fA-F]{8})-([\da-fA-F]{4})-([\da-fA-F]{4})-([\da-fA-F]{4})-([\da-fA-F]{8})([\da-fA-F]{4})$/;

function padhex(hexString, size) {
    var length = size - hexString.length;

    while (length > 0) {
        hexString = "0" + hexString;
        length --;
    }
    
    return hexString;
}

module.exports.readBytes = function(buffer, offset, noAssert) {
    if (!noAssert && offset + 16 > buffer.length) {
        throw new Error("Insufficient data to read binary GUID");
    }
    return padhex(buffer.readUInt32BE(offset, true).toString(16), 8) + "-" +
           padhex(buffer.readUInt16BE(offset+=4, true).toString(16), 4) + "-" +
           padhex(buffer.readUInt16BE(offset+=2, true).toString(16), 4) + "-" +
           padhex(buffer.readUInt16BE(offset+=2, true).toString(16), 4) + "-" +
           padhex(buffer.readUInt32BE(offset+=2, true).toString(16), 8) +
           padhex(buffer.readUInt16BE(offset+=4, true).toString(16), 4);
};

module.exports.stringToBuffer = function(guid) {
    if (typeof(guid) !== 'string') {
        throw new Error("You must pass a string GUID to convert.");
    }
    var match = guid.match(GUID_REGEXP)
    if (!match) {
        throw new Error("Invalid GUID provided");
    }
    
    var buffer = new Buffer(16);
    buffer.writeUInt32BE(parseInt(match[1],16), 0, true);
    buffer.writeUInt32BE(parseInt(match[2]+match[3],16), 4, true);
    buffer.writeUInt16BE(parseInt(match[4],16), 8, true);
    buffer.writeUInt32BE(parseInt(match[5],16), 10, true);
    buffer.writeUInt16BE(parseInt(match[6],16), 14, true);
    
    return buffer;
};

module.exports.writeBytes = function(guid, buffer, offset) {
    module.exports.stringToBuffer(guid).copy(buffer, offset, 0, 16);
};