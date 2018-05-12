var EventEmitter = require('events');
var system = new EventEmitter();

console.log("system", system);

var panel = new (require('./lib/elgato'))(system);
var buttons = new (require('./lib/buttons'))(system, panel);

system.on('exit', function() {
	panel.exit();
});

console.log("elgato",panel);
