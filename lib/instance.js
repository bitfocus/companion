var system;

function instance(system) {
	var self = this;

	return self;
}

instance.prototype.func = function () {
	var self = this;
};

exports = module.exports = function (system) {
	return new instance(system);
};
