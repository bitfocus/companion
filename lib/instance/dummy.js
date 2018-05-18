var debug   = require('debug')('lib/instance/dummy');

function instance(system, id, config) {
	var self = this;

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

};



exports = module.exports = function (system, id, config) {
	return new instance(system, id, config);
};
