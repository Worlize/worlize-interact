#!/usr/bin/env node

var sys = require('sys'),
    spawn = require('child_process').spawn,
    ChatServer = require('./lib/chatserver').ChatServer;

var VERSION = "0.1.0";

var catchExceptions = true;

var args = { /* defaults */
    port: "9000",
    debug: false
};

/* Parse command line options */
var pattern = /^--(.*?)(?:=(.*))?$/;
process.argv.forEach(function(value) {
    var match = pattern.exec(value);
    if (match) {
        args[match[1]] = match[2] ? match[2] : true;
    }
});

var port = parseInt(args['port']);
var serverId = args['serverid'];
var showHelp = args['help'];

if (showHelp) {
    console.log("Worlize Chat Server Version " + VERSION);
    console.log("--------------------------------------------");
    console.log("usage: server.js [Options]");
    console.log("");
    console.log("options:");
    console.log("  --help                Show this help information");
    console.log("");
    console.log("  --port=nnnn           Listen on port nnnn (Optional) Defaults to 9000");
    console.log("");
    console.log("  --serverid=mysrv1     Set server identifier to mysrv1 (Optional)");
    console.log("                        Defaults to <hostname>-<port>, e.g. server.foo.com-9000");
    console.log("");
    process.exit(0);    
}

var server;

if (typeof(port) == 'number' && port !== NaN && port > 0 && port < 65535) {
    if (serverId) {
        server = new ChatServer();
        server.debug = args.debug ? true : false;
        server.listen( port, serverId );
    }
    else {
        var hostname = spawn('hostname');
        hostname.stdout.addListener('data', function(data) {
            serverId = data;
        });
        hostname.addListener('exit', function(code) {
            serverId = serverId.toString().trim();
            if (code != 0) {
                console.log("Unable to determine hostname.  You must explicitly provide a serverId");
                process.exit(1);
            }
            serverId = serverId + "-" + port;
            server = new ChatServer();
            server.listen( port, serverId ); 
        });
    }
}
else {
    console.log("You must specify a valid port number");
    process.exit(1);
}

if (catchExceptions) {
    // Top level exception handler, for safety.  Log stack trace.
    process.addListener('uncaughtException', function(error) {
        console.log("CRITICAL: Uncaught Exception!\n-----BEGIN STACK TRACE-----\n" + error.stack + "\n-----END STACK TRACE-----");
    });
}

