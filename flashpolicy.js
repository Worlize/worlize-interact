#!/usr/bin/env node

var net = require('net'),
    sys = require('sys');

policy = '<?xml version="1.0"?>\n' +
         '<!DOCTYPE cross-domain-policy SYSTEM "http://www.macromedia.com/xml/dtds/cross-domain-policy.dtd">\n' +
         '<cross-domain-policy>\n' +
         '<allow-access-from domain="*.worlize.com" to-ports="80,443"/>\n' +
         '<allow-access-from domain="localhost" to-ports="80,443"/>\n' +    
         '</cross-domain-policy>\n';

net.createServer(function(socket){
        socket.write(policy);
	socket.end();
	console.log("Provided response to " + socket.remoteAddress);
}).listen(843);

console.log("Ready to accept connections on port 843.")
