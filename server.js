var kiwi = require('kiwi'),
    sys = require('sys'),
    spawn = require('child_process').spawn,
    ChatServer = require('./lib/chatserver').ChatServer;

var VERSION = "0.1.0";

var args = { /* defaults */
    port: "9000"
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
    sys.puts("Worlize Chat Server Version " + VERSION);
    sys.puts("--------------------------------------------");
    sys.puts("usage: server.js [Options]");
    sys.puts("");
    sys.puts("options:");
    sys.puts("  --help                Show this help information");
    sys.puts("");
    sys.puts("  --port=nnnn           Listen on port nnnn (Optional) Defaults to 9000");
    sys.puts("");
    sys.puts("  --serverid=mysrv1     Set server identifier to mysrv1 (Optional)");
    sys.puts("                        Defaults to <hostname>-<port>, e.g. server.foo.com-9000");
    sys.puts("");
    process.exit(0);    
}

var server;

if (typeof(port) == 'number' && port !== NaN && port > 0 && port < 65535) {
    if (serverId) {
        server = new ChatServer();
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
                sys.puts("Unable to determine hostname.  You must explicitly provide a serverId");
                process.exit(1);
            }
            serverId = serverId + "-" + port;
            server = new ChatServer();
            server.listen( port, serverId ); 
        });
    }
}
else {
    sys.puts("You must specify a valid port number");
    process.exit(1);
}
