var RedisConnectionManager = require("./redis_connection_manager");

function aton4(a) {
    a = a.split(/\./);
    return ((parseInt(a[0], 10)<<24)>>>0) + ((parseInt(a[1], 10)<<16)>>>0) + ((parseInt(a[2], 10)<<8)>>>0) + (parseInt(a[3], 10)>>>0);
}
function ntoa4(n) {
    n = n.toString();
    n = '' + (n>>>24&0xff) + '.' + (n>>>16&0xff) + '.' + (n>>>8&0xff) + '.' + (n&0xff);
    return n;
}

Banlist = {};

Banlist.isIPBanned = function(ip, callback) {
    var redis = RedisConnectionManager.getClient("restrictions");
    redis.sismember('banned_ips', aton4(ip), function(err, result) {
        if (err) {
            callback("Unable to check IP Ban due to Redis error: " + err.toString());
            return;
        }
        callback(null, result);
    });
};

module.exports = Banlist;