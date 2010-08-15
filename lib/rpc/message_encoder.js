module.exports = {
    encode: function(message) {
        return JSON.stringify(message);
    },
    decode: function(message) {
        return JSON.parse(message);
    }
};