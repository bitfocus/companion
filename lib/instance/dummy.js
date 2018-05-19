var debug   = require('debug')('lib/instance/dummy');

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
			label: 'Hostname',
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
		'action_one': { label: 'Action one!' },
		'action_two': { label: 'Action one!' }
	});
}

instance.prototype.action = function(id) {
	debug('run action:', id);
};

exports = module.exports = function (system, id, config) {
	return new instance(system, id, config);
};
