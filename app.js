var EventEmitter = require('events');
var system = new EventEmitter();
var fs = require("fs");

var config = new (require('./bitfocus-libs/config'))(system, {
	http_port: 8000,
	http_bind: "0.0.0.0"
});

var packageinfo = new (require('./bitfocus-libs/packageinfo'))(system);
console.log("packageinfo", packageinfo);


var http   = new (require('./lib/http'))(system);
var elgato = new (require('./lib/elgato'))(system);
system.on('skeleton-ready', function() {
	console.log("SKEL READY");
	system.emit('skeleton-log', JSON.stringify({path: fs.readdirSync(__dirname),pak:packageinfo }));
});

system.on('config_loaded', function(config) {
	system.emit('skeleton-info', 'appName', packageinfo.description);
	system.emit('skeleton-info', 'appVersion', packageinfo.version);
	system.emit('skeleton-info', 'appURL', 'http://127.0.0.1:8000');
	system.emit('skeleton-info', 'appStatus', 'Server running');
});


system.on('exit', function() {
	console.log("somewhere, the system wants to exit. kthxbai");
	process.exit();
})

exports = module.exports = function() {
	return system;
}

//	system.emit('skeleton-log', "Version");
