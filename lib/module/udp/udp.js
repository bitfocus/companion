var instance_skel = require('../../instance_skel');
var debug;
var log;
var udp           = require('../../udp');

function instance(system, id, config) {
	var self = this;

	// super-constructor
	instance_skel.apply(this, arguments);

	self.actions(); // export actions

	// Example: When this script was committed, a fix needed to be made
	// this will only be run if you had an instance of an older "version" before.
	// "version" is calculated out from how many upgradescripts your intance config has run.
	// So just add a addUpgradeScript when you commit a breaking change to the config, that fixes
	// the config.

	self.addUpgradeScript(function () {
		// just an example
		if (self.config.host !== undefined) {
			self.config.old_host = self.config.host;
		}
	});


	return self;
}

instance.prototype.updateConfig = function(config) {
	var self = this;

	self.init_udp()
	self.config = config;

	
};

instance.prototype.init_udp = function() {
	var self = this;
	
	if (self.udp !== undefined) {
		self.udp.destroy();
		delete self.udp;
	}

	self.status(self.STATE_WARNING, 'Connecting');

	if (self.config.host !== undefined) {
		self.udp = new udp(self.config.host, self.config.port);

		self.udp.on('error', function (err) {
			debug("Network error", err);
			self.status(self.STATE_ERROR, err);
			self.log('error',"Network error: " + err.message);
		});

		self.udp.on('status_change', function (status, message) {
			self.status(status, message);
		});
	}
};


instance.prototype.init = function() {
	var self = this;

	self.status(self.STATE_OK);

	self.init_udp();

	debug = self.debug;
	log = self.log;
};

// Return config fields for web config
instance.prototype.config_fields = function () {
	var self = this;
	return [
		{
			type: 'textinput',
			id: 'host',
			label: 'Target IP',
			width: 8,
			regex: self.REGEX_IP
		},
		{
			type: 'textinput',
			id: 'port',
			label: 'Target Port',
			width: 4,
			regex: self.REGEX_PORT
		}
	]
};

// When module gets deleted
instance.prototype.destroy = function() {
	var self = this;
	debug("destroy");
};

instance.prototype.actions = function(system) {
	var self = this;
	self.system.emit('instance_actions', self.id, {
		'send_string': {
			label: 'Send string',
			options: [
				{
					 type: 'textinput',
					 label: 'UDP Message',
					 id: 'message',
					 default: ''
				}
			]
		}

	});
}

instance.prototype.action = function(action) {
	var self = this;

	debug('action: ', action);
	console.log("SELF UDP", self.udp)
	if (action.action == 'send_string') {
		self.udp.send(action.options.message + "\n");
	}

};

instance_skel.extendedBy(instance);
exports = module.exports = instance;
