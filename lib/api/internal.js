var express = require('express'),
    Log = require('../util/log'),
    util = require('util');

var logger = Log.getLogger('api.internal');

module.exports = {
    app: null,
    port: 7000,
    host: "127.0.0.1",
    serverId: "none",
    
    start: function(options) {
        var self = this;
        
        if (options) {
            for (var key in options) {
                this[key] = options[key];
            }
        }
        
        var app = this.app = express.createServer();

        // Configuration

        app.configure(function(){
          // app.set('views', __dirname + '/views');
          // app.set('view engine', 'jade');
          app.use(express.logger({
              stream: process.stdout,
              format: self.serverId + ' - [INFO] - *** - class=api.internal :remote-addr ":method :url HTTP/:http-version" status=:status length=:res[content-length] time=:response-time'
          }));
          app.use(express.bodyParser());
          app.use(express.methodOverride());
          app.use(app.router);
          // app.use(express.static(__dirname + '/public'));
        });

        app.configure('development', function(){
          app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
        });

        app.configure('production', function(){
          app.use(express.errorHandler());
        });

        // Routes
        require('./internal/controllers/room_definition')(app);

        app.listen(this.port, this.host, function(){
          logger.info(util.format("Internal API server listening on port %d in %s mode", app.address().port, app.settings.env));
        });
    }
};