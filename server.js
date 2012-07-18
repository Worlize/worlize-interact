#!/usr/bin/env node
var VERSION = "0.1.0";
var catchExceptions = true;

var args = { /* defaults */
    port: "9000",
    apiport: "7000",
    apihost: "127.0.0.1",
    debug: false,
    loglevel: 'debug',
    logfile: false,
    logtimestamps: false,
    "node-env": 'development'
};

/* Parse command line options */
var pattern = /^--(.*?)(?:=(.*))?$/;
process.argv.forEach(function(value) {
    var match = pattern.exec(value);
    if (match) {
        args[match[1]] = match[2] ? match[2] : true;
    }
});

var logLevels = {
    "debug3": 0,
    "debug2": 2,
    "debug":  4,
    "info":   6,
    "warn":   8,
    "error":  10,
    "fatal":  12
};

var port = parseInt(args['port']);
var listenip = args['listenip'];
var apiport = parseInt(args['apiport']);
var apilistenip = args['apihost'];
var serverId = args['serverid'];
var showHelp = args['help'];
var logLevel = logLevels[args['loglevel'].toLowerCase()];
var logfile = args['logfile'];
var logtimestamps = args['logtimestamps'];
var nodeEnv = args['node-env'];
process.env['NODE_ENV'] = nodeEnv;

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
    console.log("  --loglevel=<level>    Set log level.  Default is debug.");
    console.log("                        Accepted values, in order of increasing verbosity:");
    console.log("                          fatal, error, warn, info, debug, debug2, debug3");
    console.log("");
    console.log("  --logfile=<filename>  Log output to a file instead of stdout.");
    console.log("");
    console.log("  --logtimestamps       Include timestamps in log output.");
    console.log("");
    console.log("  --apiport=<port>      Specify the port that the internal REST API service");
    console.log("                          listen on.");
    console.log("");
    console.log("  --apihost=<ip>        Specify which IP address the internal REST API should");
    console.log("                          listen on.");
    console.log("");
    console.log("  --node-env=<env>      Use 'production' to run in production mode, or");
    console.log("                        use 'development' to run in development mode.");
    console.log("");
    process.exit(0);
}
else {
    console.log("For usage information, run with --help.");
}

if (typeof(logLevel) !== 'number') {
    console.log("Invalid log level: " + args['loglevel']);
    process.exit(1);
}
else {
    console.log("Log level: " + args['loglevel']);
}

var spawn = require('child_process').spawn,
    os = require('os'),
    http = require('http'),
    ChatServer = require('./lib/chat_server'),
    PresenceServer = require('./lib/presence_server'),
    InternalAPIServer = require('./lib/api/internal'),
    WebSocketServer = require('websocket').server,
    WebSocketRouter = require('websocket').router,
    redisConnectionManager = require('./lib/model/redis_connection_manager'),
    Log = require('./lib/util/log'),
    ConsoleTarget = require('./lib/util/console_target'),
    FileTarget = require('./lib/util/file_target');

var logger = Log.getLogger('main');

var logTarget;
var shutdownLogTarget;
if (typeof(logfile) === 'string') {
    logTarget = new FileTarget();
    logTarget.logFilePath = logfile;
    console.log("Logging to " + logfile);
}
else {
    logTarget = new ConsoleTarget();
}
logTarget.logTime = logtimestamps;
logTarget.logIdentifier = true;
logTarget.logSeverity = true;
logTarget.logLevel = logLevel;
logTarget.instanceId = serverId;
logTarget.logInstanceId = true;
Log.addTarget(logTarget);

logger.info('Starting Worlize Interactivity Server ' + VERSION);

var terminationRequests = 0;
var server;
var httpServer;
var webSocketServer;
var webSocketRouter;
var chatServer;
var presenceServer;

function listen(port, listenip, serverId) {
    logger.info("Server ID: " + serverId);
    
    httpServer = http.createServer(function(req, res) {
        logger.info("Request for url " + req.url);
        res.writeHead(200, {'Content-Type': 'text/plain'});
        res.end("Nothing to see here.  Move along.\n");
    });
    
    if (listenip) {
        httpServer.listen(port, listenip, function() {
            logger.info("Listening on " + listenip + ":" + port);
        });
    }
    else {
        httpServer.listen(port, function() {
            logger.info("Listening on 0.0.0.0:" + port);
        });
    }
    
    webSocketServer = new WebSocketServer({
        // config options...
        httpServer: httpServer
    });
    
    webSocketRouter = new WebSocketRouter();
    webSocketRouter.attachServer(webSocketServer);
    
    chatServer = new ChatServer(serverId);
    chatServer.debug = args.debug ? true : false;
    chatServer.mount( webSocketRouter );
    
    presenceServer = new PresenceServer();
    presenceServer.debug = args.debug ? true : false;
    presenceServer.mount( webSocketRouter, serverId );
    
    InternalAPIServer.start({
        host: apilistenip,
        port: apiport,
        serverId: serverId
    });
    apiServer = InternalAPIServer.app;
}

if (typeof(port) == 'number' && port !== NaN && port > 0 && port < 65535) {
    if (serverId) {
        listen(port, listenip, serverId);
    }
    else {
        var hostname = os.hostname();
        serverId = hostname + "-" + port;
        listen(port, listenip, serverId);
    }
}
else {
    logger.fatal("You must specify a valid port number");
    process.exit(1);
}

function handleSignalToTerminate() {
    if (!shutdownLogTarget) {
        shutdownLogTarget = new ConsoleTarget();
        shutdownLogTarget.logTime = false;
        shutdownLogTarget.logIdentifier = true;
        shutdownLogTarget.logNotation = false;
        shutdownLogTarget.logSeverity = false;
        shutdownLogTarget.logLevel = logLevels['info'];
        shutdownLogTarget.logInstanceId = false;
        Log.addTarget(shutdownLogTarget);
    }
    terminationRequests ++;
    if (terminationRequests === 2) {
        logger.info("Received two termination requests. Exiting Immediately.");
        process.exit(1);
    }
    
    logger.info("Shutting down...");
    
    var shutdownFailedTimeout;
    
    var callbacksRemaining = 2;
    
    function handleShutdownComplete() {
        callbacksRemaining --;
        if (callbacksRemaining === 0) {
            redisConnectionManager.shutDown();
            webSocketServer.shutDown();
            setTimeout(function() {
                logger.info("Shutdown complete");
                if (shutdownFailedTimeout) {
                    clearTimeout(shutdownFailedTimeout);
                }
                process.exit(0);
            }, 1000);
        }
    }
    
    shutdownFailedTimeout = setTimeout(function() {
        logger.fatal("Graceful shutdown failed.  Terminating.");
        redisConnectionManager.shutDown();
        webSocketServer.shutDown();
        setTimeout(function() {
            process.exit(1);
        }, 1000);
    }, 8000);

    // Stop accepting new connections.
    httpServer.close();
    
    chatServer.shutDown(handleShutdownComplete);
    presenceServer.shutDown(handleShutdownComplete);
}

process.on('SIGINT', handleSignalToTerminate);
process.on('SIGTERM', handleSignalToTerminate);

if (catchExceptions) {
    // Top level exception handler, for safety.  Log stack trace.
    process.addListener('uncaughtException', function(error) {
        var logObject = {
            stackTrace: error.stack
        };
        logger.fatal("Uncaught Exception: " + JSON.stringify(logObject));
        logger.debug("Stack Trace:\n" + error.stack);
    });
}

