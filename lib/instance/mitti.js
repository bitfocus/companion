var debug   = require('debug')('lib/instance/mitti');
var toggle_play_state = 1
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
			label: 'Mitti IP',
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
		'toggle_play': { label: 'Toggle Play' },
		'stop': { label: 'Stop' },
		'panic': { label: 'Panic' },
		'rewind': { label: 'Rewind' },
		'jump_prev': { label: 'Jump to previous cue' },
		'jump_next': { label: 'Jump to next cue' },
		'select_prev': { label: 'Select previous cue' },
		'select_next': { label: 'Select next cue' }
	});
}

instance.prototype.action = function(id) {
	var self = this;
	debug('run action:', id);

	var osc = {
		'play': '/mitti/play',
		'toggle_play': '/mitti/togglePlay ',
		'stop': '/mitti/stop',
		'panic': '/mitti/panic',
		'rewind': '/mitti/rewind',
		'jump_prev': '/mitti/jumpToPrevCue',
		'jump_next': '/mitti/jumpToNextCue',
		'select_prev': '/mitti/selectPrevCue',
		'select_next': '/mitti/selectNextCue'
	};

	if (osc[id] == '/mitti/togglePlay ') {
		debug('sending special',osc[id] + toggle_play_state,"to",self.config.host);
		self.system.emit('osc_send', self.config.host, 51000, osc[id] + toggle_play_state, [])
		toggle_play_state = toggle_play_state ? 0 : 1;
	}

	else if (osc[id] !== undefined) {
		debug('sending',osc[id],"to",self.config.host);
		self.system.emit('osc_send', self.config.host, 51000, osc[id], [])
	}

};

exports = module.exports = function (system, id, config) {
	return new instance(system, id, config);
};
