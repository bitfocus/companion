var streamDeck = new (require('streamdeck-driver'))();

var system;

function elgato(system) {
	var self = this;

	system.on('config_loaded', function(config) {
	});

	streamDeck.on('down', keyIndex => {
		system.emit('skeleton-log', "Button down: "+ keyIndex);
	});

	return self;
}

elgato.prototype.log = function () {
	var self = this;
	var args = Array.prototype.slice.call(arguments);
	args.unshift('log', 'elgato');
	console.log(args);
};

exports = module.exports = function (system, port) {
	return new elgato(system, port);
};
