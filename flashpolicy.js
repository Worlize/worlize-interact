var net = require('net'),
    sys = require('sys');
    
net.createServer(function(socket){
	socket.write('<?xml version="1.0"?>\n');
	socket.write('<!DOCTYPE cross-domain-policy SYSTEM "http://www.macromedia.com/xml/dtds/cross-domain-policy.dtd">\n');
	socket.write('<cross-domain-policy>\n');
	socket.write('<allow-access-from domain="*.worlize.com" to-ports="80,443"/>\n');
	socket.write('<allow-access-from domain="localhost" to-ports="80,443"/>\n');
	socket.write('</cross-domain-policy>\n');
	socket.end();
	sys.log("Provided response to " + socket.remoteAddress);
}).listen(843);

sys.log("Ready to accept connections on port 843.")