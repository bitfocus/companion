var EventEmitter = require('events');
var system = new EventEmitter();
var fs = require("fs");

var config = new (require('./bitfocus-libs/config'))(system, {
	http_port: 8000,
	bind_ip: "127.0.0.1",
});

var packageinfo = new (require('./bitfocus-libs/packageinfo'))(system);
console.log("packageinfo", packageinfo);


var http   = new (require('./lib/http'))(system);
var elgato = new (require('./lib/elgato'))(system);

system.on('skeleton-ready', function() {
	system.emit('skeleton-log', JSON.stringify({  }));
});

system.on('config_loaded', function(config) {
	system.emit('skeleton-info', 'appName', packageinfo.description);
	system.emit('skeleton-info', 'appVersion', packageinfo.version);
  //system.emit('skeleton-info', 'appURL', 'http://'+config.bind_ip+':'+config.http_port);
	system.emit('skeleton-info', 'appStatus', 'Server running');
	system.emit('skeleton-info', 'bindInterface', config.bind_ip);
});

system.on('skeleton-bind-ip', function(ip) {
	system.emit('config_set', 'bind_ip', ip);
	config.bind_ip = ip;
	console.log("sysip", config.bind_ip);
	system.emit('ip_rebind');
});

system.on('exit', function() {
	console.log("somewhere, the system wants to exit. kthxbai");
	process.exit();
})

exports = module.exports = function() {
	return system;
}

//	system.emit('skeleton-log', "Version");
