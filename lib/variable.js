var system;
var debug   = require('debug')('lib/variable');

function variable(system) {
	var self = this;

	return self;
}

variable.prototype.func = function () {
	var self = this;
};

exports = module.exports = function (system) {
	return new variable(system);
};
