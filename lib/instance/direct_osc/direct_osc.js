var debug   = require('debug')('instance/direct_osc');

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
			width: 8
		},
		{
			type: 'textinput',
			id: 'port',
			label: 'Target Port',
			width: 4
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
					 default: "text",
				}
			]
		}

	});
}

instance.prototype.action = function(action) {
	var self = this;

	console.log("action", action);

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

exports = module.exports = instance;
