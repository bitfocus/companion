var util = require('util');
var debug = require('debug')('instance_skel');

function instance(system, id, config) {
	var self = this;

	self.system = system;
	self.id = id;
	self.config = config;
	self._versionscripts = [];
}

instance.prototype._init = function () {
	var self = this;

	self.debug = require('debug')('instance:' + self.constructor.module_info.id + ':' + self.id);

	// Log to the skeleton (launcher) log window
	self.log = function (info) {
		self.system.emit('skeleton-log', self.constructor.module_info.id + ': ' + info);
	};

	// Update instance health, levels: null = unknown, 0 = ok, 1 = warning, 2 = error
	self.status = function(level,message) {
		self.system.emit('instance_status_update', self.id, level, message);
	}

	debug("MODULE:", self.constructor.module_info.id, "CONFIG:", self.config);

	if (typeof self.init == 'function') {
		self.init();
	}
};

instance.prototype.upgradeConfig = function () {
	var self = this;

	console.log("UpgradeConfig, idx: ", self.config._configIdx, " full config: ", self.config);
	var idx = self.config._configIdx;
	if (idx === undefined) {
		idx = -1;
	}

	console.log("upgradeConfig(" + self.constructor.module_info.id + "): ", idx + 1, 'to', self._versionscripts.length);

	for (var i = idx + 1; i < self._versionscripts.length; ++i) {
		require('debug')('instance:' + self.constructor.module_info.id + ':' + self.id)('UpgradeConfig: Upgrading to version ' + (i + 1));
			self._versionscripts[i]();
		self.config._configIdx = i;
	}
	require('debug')('instance:' + self.constructor.module_info.id)('instance save');
	self.system.emit('instance_save');
}

instance.prototype.addUpgradeScript = function (cb) {
	var self = this;

	self._versionscripts.push(cb);
};

instance.extendedBy = function (module) {
	util.inherits(module, instance);
}

module.exports = instance;
