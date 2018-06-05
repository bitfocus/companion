var instance_skel = require('../../instance_skel');
var debug;
var log;

function instance(system, id, config) {
	var self = this;

	// super-constructor
	instance_skel.apply(this, arguments);

	self.actions(); // export actions

	return self;
}

instance.prototype.init = function() {
	var self = this;
	self.status(0);
	debug = self.debug;
	log = self.log;
};

// Return config fields for web config
instance.prototype.config_fields = function () {
	var self = this;
	return [
		{
			type: 'textinput',
			id: 'host',
			label: 'Target IP',
			width: 6,
			regex: self.REGEX_IP
		},
		{
			type: 'textinput',
			id: 'port',
			label: 'OSC Port',
			width: 6,
			regex: self.REGEX_PORT
		}

	]
};

// When module gets deleted
instance.prototype.destroy = function() {
	var self = this;

	debug("destroy");
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

instance.prototype.action = function(action) {
	var self = this;
	var id = action.action;

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

instance.module_info = {
	label: 'Disguise d3 OSC',
	id: 'disguise',
	version: '0.0.1'
};

instance_skel.extendedBy(instance);
exports = module.exports = instance;
