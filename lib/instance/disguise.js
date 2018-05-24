var debug   = require('debug')('lib/instance/disguise');

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
			label: 'IP',
			width: 6
		},
		{
			type: 'textinput',
			id: 'port',
			label: 'OSC Port',
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
		'play': { label: 'Play' },
		'play_to_end': { label: 'Play to end of section' },
		'loop_section': { label: 'Loop section' },
		'stop': { label: 'Stop' },
		'previous_section': { label: 'Previous Section' },
		'next_section': { label: 'Next Section' },
		'previous_track': { label: 'Previous track' },
		'next_track': { label: 'Next track' },
		'fade_up': { label: 'Master brightness - Fade up' },
		'fade_down': { label: 'Master brightness - Fade down' }
	});

}

instance.prototype.action = function(id) {
	var self = this;

	debug('run action:', id);

	var osc = {
		'play': '/d3/showcontrol/play',
		'play_to_end': '/d3/showcontrol/playsection',
		'loop_section': '/d3/showcontrol/loop',
		'stop': '/d3/showcontrol/stop',
		'previous_section': '/d3/showcontrol/previoussection',
		'next_section': '/d3/showcontrol/nextsection',
		'previous_track': '/d3/showcontrol/previoustrack',
		'next_track': '/d3/showcontrol/nexttrack',
		'fade_up': '/d3/showcontrol/fadeup',
		'fade_down': '/d3/showcontrol/fadedown'
	};

	if (osc[id] !== undefined) {
		debug('sending',osc[id],"to",self.config.host);
		self.system.emit('osc_send', self.config.host, (parseInt(self.config.port) > 1024 ? parseInt(self.config.port) : 51000), osc[id], [])
	}

};

exports = module.exports = function (system, id, config) {
	return new instance(system, id, config);
};
