var EventEmitter = require('events');
var system = new EventEmitter();
var fs = require("fs");
var path = require('path')

var config = new (require('./bitfocus-libs/config'))(system, {
	http_port: 8000,
	bind_ip: "127.0.0.1",
});

system.on('config_loaded', function(config) {
  system.emit('skeleton-info', 'appURL', 'Waiting for webserver..');
	system.emit('skeleton-info', 'appStatus', 'Starting');
	system.emit('skeleton-info', 'bindInterface', config.bind_ip);
});

system.on('exit', function() {
	console.log("somewhere, the system wants to exit. kthxbai");
	process.exit();
})

system.on('skeleton-bind-ip', function(ip) {
	config.bind_ip = ip;
	system.emit('config_set', 'bind_ip', ip);
	system.emit('ip_rebind');
});

system.on('skeleton-ready', function() {
	var http   = new (require('./lib/http'))(system);
	var elgato = new (require('./lib/elgato'))(system);
});

exports = module.exports = function() {
	return system;
}

//	system.emit('skeleton-log', "Version");
