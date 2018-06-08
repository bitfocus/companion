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

	self.init_tcp();
};

instance.prototype.init_tcp = function() {
	var self = this;

	if (self.socket !== undefined) {
		self.socket.unload();
	}

	if (self.config.host) {
		self.socket = new tcp(self.config.host, 3000);

		self.socket.on('status_change', function (status, message) {
			self.status(status, message);
		});

		self.socket.on('error', function (err) {
			debug("Network error", err);
			self.log('error',"Network error: " + err.message);
		});

		self.socket.on('connect', function () {
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
			label: 'IP-Adress of PDS',
			width: 6,
			default: '192.168.0.10',
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
		'TAKE': {
			label: 'Take'
			},
		'ISEL': {
			 label: 'Select Input',
			 options: [{
				type: 'dropdown',
 				label: 'Input',
 				id: 'i',
 				default: '1',
 				choices: {
					1: '1 VGA',
					2: '2 VGA',
					3: '3 VGA',
					4: '4 VGA',
					5: '5 DVI',
					6: '6 DVI',
					7: '7 DVI (PDS-90x only)',
					8: '8 DVI (PDS-90x only)',
					9: '9 SDI (PDS-902 only)',
					10: 'Black/Logo'
					}
				},{
				type: 'textinput',
				label: 'Filenumber (optional)',
				id: 'f',
				default: '',
				regex: '/^([1-9]|[1-5][0-9]|6[0-4])$/'
			}]},
		'FREEZE': {
			label: 'Freeze',
			options: [{
				type: 'dropdown',
				label: 'Freeze',
				id: 'm',
				default: '1',
				choices: { 0: 'unfrozen', 1: 'frozen'}
			}]},
		'BLACK': {
			label: 'Set Black Output',
			options: [{
				type: 'dropdown',
				label: 'Mode',
				id: 'm',
				default: '1',
				choices: { 0: 'normal', 1: 'black'}
			}]},
		'OTPM': {
			label: 'Set Testpattern on/off',
			options: [{
				type: 'dropdown',
				label: 'Output',
				id: 'o',
				default: '1',
				choices: { 1: 'Program', 3: 'Preview'}
			},{
				type: 'dropdown',
				label: 'Testpattern',
				id: 'm',
				default: '1',
				choices: { 0: 'off', 1: 'on'}
			}]},
		'OTPT': { label: 'Set Testpattern Type',
			options: [{
				type: 'dropdown',
				label: 'Output',
				id: 'o',
				default: '1',
				choices: { 1: 'Program', 3: 'Preview'}
			},{
				type: 'dropdown',
				label: 'Type',
				id: 't',
				default: '4',
				choices: {
					4: '16x16 Grid',
					5: '32x32 Grid',
					1: 'H Ramp',
					2: 'V Ramp',
					6: 'Burst',
					7: '75% Color Bars',
					3: '100% Color Bars',
					9: 'Vertical Gray Steps',
					10: 'Horizontal Gray Steps',
					8: '50% Gray',
					11: 'White',
					12: 'Black',
					13: 'Red',
					14: 'Green',
					15: 'Blue'
				}
			}]},
		'TRNTIME': { label: 'Set Transition Time',
			options: [{
				type: 'textinput',
				label: 'Seconds',
				id: 's',
				default: '1.0',
				regex: '/^([0-9]|1[0-2])(\\.\\d)?$/'
			}]},
		'LOGOSEL': {
			label: 'Select Black/Logo',
				options: [{
				type: 'dropdown',
				label: 'Framestore',
				id: 'l',
				default: '1',
				choices: {
					0: 'Black',
					1: 'Logo 1',
					2: 'Logo 2',
					3: 'Logo 3'
				}
			}]},
		'LOGOSAVE': {
			label: 'Save Logo',
				options: [{
				type: 'dropdown',
				label: 'Framestore',
				id: 'l',
				default: '1',
				choices: {
					1: 'Logo 1',
					2: 'Logo 2',
					3: 'Logo 3'
				}
			}]}
	});
}

instance.prototype.action = function(action) {
	var self = this;
	debug('run PDS action:', action);

	var cmd = action.action;
	for (var option in action.options) {
		if (action.options.hasOwnProperty(option) && action.options[option] != '') cmd += " -" + option + " " + action.options[option];
	}
	cmd +="\r";

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
};

instance.module_info = {
	label: 'Barco PDS',
	id: 'barco_pds',
	version: '0.0.1'
};

instance_skel.extendedBy(instance);
exports = module.exports = instance;
