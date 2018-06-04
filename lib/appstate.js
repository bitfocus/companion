var system;
var debug = require('debug')('lib/appstate');

function appstate(system) {
	var self = this;

	self.stateLabel = {
		'web': 'Webserver',
		'elgato': 'Elgato'
	};

	self.state = {
		'web': false,
		'elgato': false
	};

	self.stateText = {
		'web': '',
		'elgato': ''
	};

	system.on('appstate_update', function(app,state) {
		self.state[app] = state;
		system.emit('appstate', self.state);
	});

	system.on('appstate_update', function(app,state) {
		self.state[app] = state;
	});

	system.on('appstate_update', function(app,state) {
		self.state[app] = state;
	});



	return self;
}

appstate.prototype.log = function () {
	var self = this;
};

exports = module.exports = function (system) {
	return new appstate(system);
};
