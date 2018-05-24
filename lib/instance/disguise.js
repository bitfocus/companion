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
	// disguise port 51000
	var osc = {
		'play': '/mitti/play',
		'toggle_play': '/mitti/togglePlay',
		'stop': '/mitti/stop',
		'panic': '/mitt/panic',
		'rewind': '/mitti/rewind',
		'jump_prev': '/mitti/jumpToPrevCue',
		'jump_next': '/mitti/jumpToNextCue',
		'select_prev': '/mitti/selectPrevCue',
		'select_next': '/mitti/selectNextCue'
	};
	if (osc[id] !== undefined) {
		debug('sending',osc[id],"to",self.config.host);
		self.system.emit('osc_send', self.config.host, (parseInt(self.config.port) > 1024 ? parseInt(self.config.port) : 51000), osc[id], [])
	}
};

exports = module.exports = function (system, id, config) {
	return new instance(system, id, config);
};
