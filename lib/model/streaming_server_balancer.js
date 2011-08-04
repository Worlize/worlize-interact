var config = require('../config');

var _instance = null;

function StreamingServerBalancer() {
	if (_instance !== null) {
		throw new Error("You can only create one instance of the singleton StreamingServerBalancer");
	}
	if (config && config.streamingConfig && config.streamingConfig.streamingServers) {
		this.streamingServers = config.streamingConfig.streamingServers;
	}
	else {
		throw new Error("Unable to load streaming server config");
	}
	
	this.currentServer = 0;
};

StreamingServerBalancer.prototype.getServerRoundRobin = function() {
	var server = this.streamingServers[this.currentServer];
	
	this.currentServer ++;
	if (this.currentServer === this.streamingServers.length) {
		this.currentServer = 0;
	}
	
	if (server && 'hostname' in server) {
		return server['hostname'];
	}
	else {
		throw new Error("There are no streaming servers available.");
	}
};

StreamingServerBalancer.prototype.getServerBalanced = function() {
	throw new Error("getServerBalanced is not yet implemented");
};

StreamingServerBalancer.prototype.getServer = function() {
	return this.getServerRoundRobin();
}

StreamingServerBalancer.getInstance = function() {
	if (_instance) {
		return _instance;
	}
	_instance = new StreamingServerBalancer;
	return _instance;
}



module.exports = StreamingServerBalancer.getInstance();