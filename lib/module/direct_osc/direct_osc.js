var instance_skel = require('../../instance_skel');
var debug;
var log;

function instance(system, id, config) {
	var self = this;

	// super-constructor
	instance_skel.apply(this, arguments);

	self.actions(); // export actions

	// Example: When this script was committed, a fix needed to be made
	// this will only be run if you had an instance of an older "version" before.
	// "version" is calculated out from how many upgradescripts your intance config has run.
	// So just add a addUpgradeScript when you commit a breaking change to the config, that fixes
	// the config.

	self.addUpgradeScript(function () {
		// just an example
		if (self.config.host !== undefined) {
			self.config.old_host = self.config.host;
		}
	});

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
			width: 8,
			regex: self.REGEX_IP
		},
		{
			type: 'textinput',
			id: 'port',
			label: 'Target Port',
			width: 4,
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
		'send_blank': {
			label: 'Send message',
			options: [
				{
					 type: 'textinput',
					 label: 'OSC Path',
					 id: 'path',
					 default: '/osc/path'
				}
			]
		},
		'send_int': {
			label: 'Send integer',
			options: [
				{
					 type: 'textinput',
					 label: 'OSC Path',
					 id: 'path',
					 default: '/osc/path'
				},
				{
					 type: 'textinput',
					 label: 'Value',
					 id: 'int',
					 default: 1,
					 regex: self.REGEX_SIGNED_FLOAT
				}
			]
		},
		'send_string': {
			label: 'Send string',
			options: [
				{
					 type: 'textinput',
					 label: 'OSC Path',
					 id: 'path',
					 default: '/osc/path'
				},
				{
					 type: 'textinput',
					 label: 'Value',
					 id: 'string',
					 default: "text"
				}
			]
		}

	});
}

instance.prototype.action = function(action) {
	var self = this;

	debug('action: ', action);

	if (action.action == 'send_blank') {
		debug('sending',self.config.host, self.config.port, action.options.path);
		self.system.emit('osc_send', self.config.host, self.config.port, action.options.path, [])
	}

	if (action.action == 'send_int') {
		var bol = {
				type: "i",
				value: parseInt(action.options.int)
		};
		self.system.emit('osc_send', self.config.host, self.config.port, action.options.path, [ bol ]);
	}

	if (action.action == 'send_string') {
		var bol = {
				type: "s",
				value: "" + action.options.string
		};
		self.system.emit('osc_send', self.config.host, self.config.port, action.options.path, [ bol ]);
	}

};

instance.module_info = {
	label: 'Direct: OSC',
	id: 'direct_osc',
	version: '0.0.1'
};

instance_skel.extendedBy(instance);
exports = module.exports = instance;
