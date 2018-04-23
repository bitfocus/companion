var EventEmitter = require('events');
var system = new EventEmitter();

system.emit('skeleton-log', "Version");

var config = new (require('../bitfocus-libs/config'))(system, {
	http_port: 8000,
	http_bind: "0.0.0.0"
});

system.on('config_loaded', function(config) {
	console.log("config", config)	
})

exports = module.exports = function() {
	return system;
}
