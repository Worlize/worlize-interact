#!/usr/bin/env node

var sys = require('sys'),
    spawn = require('child_process').spawn,
    http = require('http'),
    ChatServer = require('./lib/chat_server'),
    PresenceServer = require('./lib/presence_server'),
    WebSocketServer = require('websocket').server,
    WebSocketRouter = require('websocket').router;

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
var host = args['listenip'];
var serverId = args['serverid'];
var showHelp = args['help'];

console.log("Worlize Chat Server Version " + VERSION);
console.log("--------------------------------------------");

if (showHelp) {
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
    console.log("  --listenip=<ip>       Listen on the specified IP address only. Default is to");
    console.log("                        listen on all interfaces.");
    console.log("");
    process.exit(0);    
}
else {
    console.log("For usage information, run with --help.");
}

var server;
var httpServer;
var webSocketServer;
var webSocketRouter;

function listen(port, host, serverId) {
    console.log("Server ID: " + serverId);
    
    httpServer = http.createServer(function(req, res) {
        console.log("Request for url " + req.url);
        res.writeHead(200, {'Content-Type': 'text/plain'});
        res.end("Nothing to see here.  Move along.\n");
    });
    
    if (host) {
        httpServer.listen(port, host, function() {
            console.log("Listening on " + host + ":" + port);
        });
    }
    else {
        httpServer.listen(port, function() {
            console.log("Listening on 0.0.0.0:" + port);
        });
    }
    
    webSocketServer = new WebSocketServer({
        // config options...
        httpServer: httpServer
    });
    
    webSocketRouter = new WebSocketRouter();
    webSocketRouter.attachServer(webSocketServer);
    
    chatServer = new ChatServer();
    chatServer.debug = args.debug ? true : false;
    chatServer.mount( webSocketRouter, serverId );
    
    presenceServer = new PresenceServer();
    presenceServer.debug = args.debug ? true : false;
    presenceServer.mount( webSocketRouter, serverId );
}

if (typeof(port) == 'number' && port !== NaN && port > 0 && port < 65535) {
    if (serverId) {
        listen(port, host, serverId);
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
            listen(port, host, serverId);
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

