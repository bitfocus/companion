var EventEmitter = require('events');
var system = new EventEmitter();

setInterval(function() {
	system.emit('status', Date.now());
}, 100);

exports = module.exports = function() {
	return system;
}
