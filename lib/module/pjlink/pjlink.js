var tcp = require('../../tcp');
var instance_skel = require('../../instance_skel');
var debug;
var log;

function instance(system, id, config) {
	var self = this;

	// super-constructor
	instance_skel.apply(this, arguments);

	self.actions(); // export actions

	return self;
}

instance.prototype.init = function() {
	var self = this;

	debug = self.debug;
	log = self.log;

	self.status(1,'Connecting'); // status ok!

	self.init_tcp();
};

instance.prototype.init_tcp = function() {
	var self = this;

	if (self.socket !== undefined) {
		self.socket.unload();
	}

	if (self.config.host) {
		self.socket = new tcp(self.config.host, 4352);

		self.socket.on('status_change', function (status, message) {
			self.status(status, message);
		});

		self.socket.on('error', function (err) {
			debug("Network error", err);
			self.status(2,err);
			self.log('error',"Network error: " + err.message);
		});

		self.socket.on('connect', function () {
			self.status(0);
			debug("Connected");
		})

		self.socket.on('data', function (data) {});
	}
};


// Return config fields for web config
instance.prototype.config_fields = function () {
	var self = this;
	return [
		{
			type: 'textinput',
			id: 'host',
			label: 'Target IP',
			width: 6,
			regex: self.REGEX_IP
		}
	]
};

// When module gets deleted
instance.prototype.destroy = function() {
	var self = this;

	if (self.socket !== undefined) {
		self.socket.unload();
	}

	debug("destroy", self.id);;
};


instance.prototype.actions = function(system) {
	var self = this;

	self.system.emit('instance_actions', self.id, {
		'powerOn':        { label: 'Power On Projector' },
		'powerOff':       { label: 'Power Off Projector' },
		'shutterOpen':    { label: 'Open Shutter' },
		'shutterClose':   { label: 'Close Shutter' },
		'freeze':         { label: 'Freeze Input' },
		'unfreeze':       { label: 'Unfreeze Input' }

	});
};

instance.prototype.action = function(action) {
	var self = this;
	var id = action.action;
	var cmd

	switch (action.action){

		case 'powerOn':
			cmd = '%1powr 1 \r';
			break;

		case 'powerOff':
			cmd = '%1powr 0 \r';
			break;

		case 'shutterOpen':
			cmd = '%1avmt 30 \r';
			break;

		case 'shutterClose':
			cmd = '%1avmt 31 \r';
			break;

		case 'freeze':
			cmd = '%2frez 1 \r';
			break;

		case 'unfreeze':
			cmd = '%2frez 0 \r';
			break;

	};




				if (cmd !== undefined) {

					if (self.socket === undefined) {
						self.init_tcp();
					}

					// TODO: remove this when issue #71 is fixed
					if (self.socket !== undefined && self.socket.host != self.config.host) {
						self.init_tcp();
					}

					debug('sending tcp',cmd,"to",self.config.host);

					if (self.socket !== undefined && self.socket.connected) {
						self.socket.send(cmd);
					} else {
						debug('Socket not connected :(');
					}

				}

				debug('action():', action);

};

instance.module_info = {
	label: 'PJ Link Projectors',
	id: 'pjlink',
	version: '0.0.1'
};

instance_skel.extendedBy(instance);
exports = module.exports = instance;
