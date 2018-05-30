var debug   = require('debug')('instance/qlab');

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
		'go': { label: 'GO' },
		'pause': { label: 'Pause' },
		'stop': { label: 'Stop' },
		'panic': { label: 'Panic' },
		'reset': { label: 'Reset' },
		'previous': { label: 'Previous Cue' },
		'next': { label: 'Next Cue' },
		'resume': { label: 'Resume' }
	});
}

instance.prototype.action = function(action) {
	var self = this;
	var id = action.id;

	var osc = {
		'go': '/go',
		'pause': '/pause',
		'stop': '/stop',
		'panic': '/panic',
		'reset': '/reset',
		'previous': '/playhead/previous',
		'next': '/playhead/next',
		'resume': '/resume'

	};
	if (osc[id] !== undefined) {
		debug('sending',osc[id],"to",self.config.host);
		self.system.emit('osc_send', self.config.host, 53000, osc[id], [])
	}
};


exports = module.exports = function (system, id, config) {
	return new instance(system, id, config);
};
