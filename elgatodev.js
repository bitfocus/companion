var EventEmitter = require('events');
var system = new EventEmitter();
var debug   = require('debug')('elgatodev');

var panel = new (require('./lib/elgato'))(system);
var db = new (require('./lib/db'))(system);
var bank = new (require('./lib/bank'))(system);
var button = new (require('./lib/button'))(system, panel);
var action = new (require('./lib/action'))(system);
var instance = new (require('./lib/instance'))(system);
var variable = new (require('./lib/variable'))(system);

system.on('exit', function() {
	panel.exit();
});
