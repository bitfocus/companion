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
	self.status(0); // report status ok!
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
			tooltip: 'The IP of the computer running QLab',
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
		'go':       { label: 'GO' },
		'pause':    { label: 'Pause' },
		'stop':     { label: 'Stop' },
		'panic':    { label: 'Panic' },
		'reset':    { label: 'Reset' },
		'previous': { label: 'Previous Cue' },
		'next':     { label: 'Next Cue' },
		'resume':   { label: 'Resume' }
	});
}

instance.prototype.action = function(action) {
	var self = this;
	var id = action.action;

	var osc = {
		'go':       '/go',
		'pause':    '/pause',
		'stop':     '/stop',
		'panic':    '/panic',
		'reset':    '/reset',
		'previous': '/playhead/previous',
		'next':     '/playhead/next',
		'resume':   '/resume'
	};
	if (osc[id] !== undefined) {
		debug('sending',osc[id],"to",self.config.host);
		self.system.emit('osc_send', self.config.host, 53000, osc[id], [])
	}
};

instance.module_info = {
	label: 'Qlab',
	id: 'qlab',
	version: '0.0.1'
};

instance_skel.extendedBy(instance);
exports = module.exports = instance;
