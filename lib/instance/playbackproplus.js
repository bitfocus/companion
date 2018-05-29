var debug   = require('debug')('instance/playbackproplus');

function instance(system, id, config) {
	var self = this;

	self.system = system;
	self.id = id;
	self.config = config;

	self.actions(); // export actions

	return self;
}

// Return config fields for web config
instance.prototype.config_fields = function () {
	var self = this;
	return [
		{
			type: 'textinput',
			id: 'host',
			label: 'Target IP',
			width: 6
		}
	]
};

// When module gets deleted
instance.prototype.destroy = function() {
	var self = this;
	debug("destory", self.id);;
};

instance.prototype.actions = function(system) {
	var self = this;
	self.system.emit('instance_actions', self.id, {
		'take': { label: 'Take' },
		'pause': { label: 'Pause Resume' },
		'kill': { label: 'Kill' },
		'freeze': { label: 'Freeze temp' },
		'loop': { label: 'Loop temp' },
		'previous': { label: 'Previous Clip' },
		'next': { label: 'Next Clip' },
		'10': { label: 'Goto 10' },
		'20': { label: 'Goto 20' },
		'30': { label: 'Goto 30' }
	});
}

instance.prototype.action = function(action) {
	var self = this;
	var id = action.id;

	// playbackproplus port 7000
	var playbackproplus = {
		'take': 'TA',
		'pause': 'OP',
		'kill': 'KL',
		'freeze': 'FT',
		'loop': 'LT',
		'previous': 'PR',
		'next': 'NX',
		'10': '10',
		'20': '20',
		'30': '30'
	 };
	if (playbackproplus[id] !== undefined) {

		debug('sending',playbackproplus[id],"to",self.config.host);

		self.system.emit('udp_send', self.config.host, 7000, playbackproplus[id], function(err) {
			if (err === null) {
  			// ok
			} else {
  			debug('error', err);
			}
			});
		}
	}

exports = module.exports = function (system, id, config) {
	return new instance(system, id, config);
};
