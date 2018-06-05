var instance_skel = require('../../instance_skel');
var debug;
var log;

function instance(system, id, config) {
	var self = this;
	// super-constructor
	instance_skel.apply(this, arguments);
	self.togglePlayState = 1;
	self.actions(); // export actions
	return self;
}

instance.prototype.init = function() {
	var self = this;
	self.status(0); // status ok!
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
		'select_next': { label: 'Select next cue' },
		'goto_30': { label: 'Goto 30'},
		'goto_20': { label: 'Goto 20'},
		'goto_10': { label: 'Goto 10'}
	});
}

instance.prototype.action = function(action) {
	var self = this;
	var id = action.action;

	var osc = {
		'play': '/mitti/play',
		'toggle_play': '/mitti/togglePlay',
		'stop': '/mitti/stop',
		'panic': '/mitti/panic',
		'rewind': '/mitti/rewind',
		'jump_prev': '/mitti/jumpToPrevCue',
		'jump_next': '/mitti/jumpToNextCue',
		'select_prev': '/mitti/selectPrevCue',
		'select_next': '/mitti/selectNextCue',
		'goto_30': '/mitti/goto30',
		'goto_20': '/mitti/goto20',
		'goto_10': '/mitti/goto10'
	};

	if (osc[id] == '/mitti/togglePlay') {
		debug('sending special',osc[id] + self.togglePlayState,"to",self.config.host);
		self.system.emit('osc_send', self.config.host, 51000, osc[id],{
				type: "i",
				value: self.togglePlayState
		} );
		self.togglePlayState = self.togglePlayState ? 0 : 1;
	}

	else if (osc[id] !== undefined) {
		debug('sending',osc[id],"to",self.config.host);
		self.system.emit('osc_send', self.config.host, 51000, osc[id], [])
	}

};

instance.module_info = {
	label: 'Imimot Mitti OSC',
	id: 'mitti',
	version: '0.0.1'
};

instance_skel.extendedBy(instance);
exports = module.exports = instance;
