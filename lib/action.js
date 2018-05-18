var system;
var debug   = require('debug')('lib/action');

function action(system) {
	var self = this;
	self.system = system;
	self.actions = {};

	self.system.on('instance_actions', function(id, actions) {
		for (var n in actions) {
			var a = actions[n];
			self.actions[id+':'+n] = a;
			debug('adding action', id+':'+n);
		}
	});

	return self;
}

action.prototype.func = function () {
	var self = this;
};

exports = module.exports = function (system) {
	return new action(system);
};
