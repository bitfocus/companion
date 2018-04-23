var EventEmitter = require('events');
var system = new EventEmitter();

if (!require.main.filename.match(/bitfocus-skeleton/)) {
	process.chdir("./bitfocus-skeleton");
}

var config = new (require('./bitfocus-libs/config'))(system, {
	http_port: 8000,
	http_bind: "0.0.0.0"
});

var http = new (require('./lib/http'))(system);

system.on('config_loaded', function(config) {
	system.emit('skeleton-info', 'appName', 'Companion');
	system.emit('skeleton-info', 'appVersion', '1.0.0');
	system.emit('skeleton-info', 'appURL', 'http://127.0.0.1:8000');
	system.emit('skeleton-info', 'appStatus', 'OK');
});

exports = module.exports = function() {
	return system;
}


//	system.emit('skeleton-log', "Version");
