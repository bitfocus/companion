var util  = require('util');
var debug = require('debug')('lib/instance_skel');
var image = require('../lib/image');

function instance(system, id, config) {
	var self = this;

	self.system = system;
	self.id = id;
	self.config = config;
	self._versionscripts = [];

	self.defineConst('REGEX_IP',            '/^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/');
	self.defineConst('REGEX_BOOLEAN',       '/^(true|false|0|1)$/i');
	self.defineConst('REGEX_PORT',          '/^([1-9]|[1-8][0-9]|9[0-9]|[1-8][0-9]{2}|9[0-8][0-9]|99[0-9]|[1-8][0-9]{3}|9[0-8][0-9]{2}|99[0-8][0-9]|999[0-9]|[1-5][0-9]{4}|6[0-4][0-9]{3}|65[0-4][0-9]{2}|655[0-2][0-9]|6553[0-4])$/');
	self.defineConst('REGEX_FLOAT',         '/^([0-9]*\\.)?[0-9]+$/');
	self.defineConst('REGEX_SIGNED_FLOAT',  '/^[+-]?([0-9]*\\.)?[0-9]+$/');
	self.defineConst('REGEX_NUMBER',        '/^\\d+$/');
	self.defineConst('REGEX_SIGNED_NUMBER', '/^[+-]?\\d+$/');
	self.defineConst('REGEX_TIMECODE'),     '/^(0*[0-9]|1[0-9]|2[0-4]):(0*[0-9]|[1-5][0-9]|60):(0*[0-9]|[1-5][0-9]|60):(0*[0-9]|[12][0-9]|30)$/'

	self.defineConst('CHOICES_YESNO_BOOLEAN', [ { id: 'true', label: 'Yes' }, { id: 'false', label: 'No' } ]);

	self.defineConst('STATE_UNKNOWN', null);
	self.defineConst('STATE_OK', 0);
	self.defineConst('STATE_WARNING', 1);
	self.defineConst('STATE_ERROR', 2);
}

instance.prototype.defineConst = function(name, value) {
	Object.defineProperty(this, name, {
		value:      value,
		enumerable: true
	});
};

instance.prototype.rgb = image.rgb;

instance.prototype._init = function () {
	var self = this;

	// These two functions needs to be defined after the module has been instanced,
	// as they reference the original constructors static data

	// Debug with module-name prepeded
	self.debug = require('debug')('instance:' + self.constructor.module_info.id + ':' + self.id);

	// Log to the skeleton (launcher) log window
	self.log = function (level, info) {
		self.system.emit('log', 'instance(' + self.label + ')', level, info);
	};

	debug("MODULE:", self.constructor.module_info.id, "CONFIG:", self.config);

	if (typeof self.init == 'function') {
		self.init();
	}
};

// Update instance health, levels: null = unknown, 0 = ok, 1 = warning, 2 = error
instance.prototype.status = function (level, message) {
	var self = this;

	self.system.emit('instance_status_update', self.id, level, message);
};

instance.prototype.upgradeConfig = function () {
	var self = this;

	console.log("UpgradeConfig, idx: ", self.config._configIdx, " full config: ", self.config);
	var idx = self.config._configIdx;
	if (idx === undefined) {
		idx = -1;
	}

	debug("upgradeConfig(" + self.label + "): " + (idx + 1) + 'to' + self._versionscripts.length);

	for (var i = idx + 1; i < self._versionscripts.length; ++i) {
		require('debug')('instance:' + self.constructor.module_info.id + ':' + self.id)('UpgradeConfig: Upgrading to version ' + (i + 1));
			self._versionscripts[i]();
		self.config._configIdx = i;
	}
	require('debug')('instance:' + self.constructor.module_info.id)('instance save');
	self.system.emit('instance_save');
};

instance.prototype.addUpgradeScript = function (cb) {
	var self = this;

	self._versionscripts.push(cb);
};

instance.prototype.setVariableDefinitions = function (variables) {
	var self = this;

	self.system.emit('variable_instance_definitions_set', self, variables);
};

instance.prototype.setVariable = function(variable, value) {
	var self = this;

	self.system.emit('variable_instance_set', self, variable, value);
};

instance.prototype.setFeedbackDefinitions = function(feedbacks) {
	var self = this;

	self.system.emit('feedback_instance_definitions_set', self, feedbacks);
};

instance.prototype.checkFeedbacks = function() {
	var self = this;

	self.system.emit('feedback_instance_check', self);
};

instance.extendedBy = function (module) {
	util.inherits(module, instance);
};

module.exports = instance;
