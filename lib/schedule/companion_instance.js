const plugin_base = require('./plugin_base');

class companion_instance extends plugin_base {
	setup() {}

	type() {
		return 'instance';
	}
}

module.exports = companion_instance;
