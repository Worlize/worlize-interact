#!/usr/bin/env node

var net = require('net');

var args = { /* defaults */
    devel: false
};

/* Parse command line options */
var pattern = /^--(.*?)(?:=(.*))?$/;
process.argv.forEach(function(value) {
    var match = pattern.exec(value);
    if (match) {
        args[match[1]] = match[2] ? match[2] : true;
    }
});


policy  = '<?xml version="1.0"?>\n';
policy += '<!DOCTYPE cross-domain-policy SYSTEM "http://www.macromedia.com/xml/dtds/cross-domain-policy.dtd">\n';
policy += '<cross-domain-policy>\n';
policy += '<allow-access-from domain="*.worlize.com" to-ports="80,443"/>\n';
if (args.devel) {
    policy += '<allow-access-from domain="*.worlize.local" to-ports="80,443"/>\n';
    policy += '<allow-access-from domain="localhost" to-ports="80,443"/>\n';
}
policy += '</cross-domain-policy>\n';

net.createServer(function(socket){
    socket.write(policy);
	socket.end();
	console.log("Provided response to " + socket.remoteAddress);
}).listen(843);

console.log("Ready to accept connections on port 843.")

if (args.devel) {
    console.log("Development mode enabled.  Allowing access from *.worlize.local and localhost");
}