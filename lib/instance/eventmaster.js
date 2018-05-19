var debug   = require('debug')('lib/instance/eventmaster');

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
			label: 'E2/S3 IP',
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
		'trans_all': { label: 'Transition Active' },
		'cut_all': { label: 'Cut Active' }
	});
}

instance.prototype.action = function(id) {
	debug('run action:', id);
};

exports = module.exports = function (system, id, config) {
	return new instance(system, id, config);
};
