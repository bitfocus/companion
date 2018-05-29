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
			label: 'Send blank message',
			options: [
				{
					 type: 'textinput',
					 label: 'OSC Path',
					 id: 'string',
					 default: '/osc/path'
				}
			]
		},
		'send_bool': {
			label: 'Send bool message',
			options: [
				{
					 type: 'dropdown',
					 label: 'Message bool',
					 id: 'bool',
					 default: 0,
					 choices: [
						 'true',
						 'false'
					 ]
				}
			]
		}
	});
}

instance.prototype.action = function(action) {
	var self = this;

	if (action.action == 'send_blank') {
		debug('sending',self.config.host, self.config.port, action.options.string);
		self.system.emit('osc_send', self.config.host, self.config.port, action.options.string, [])
	}



};


exports = module.exports = function (system, id, config) {
	return new instance(system, id, config);
};
