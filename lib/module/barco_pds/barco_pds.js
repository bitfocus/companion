var tcp = require('../../tcp');
var instance_skel = require('../../instance_skel');
var debug;
var log;

function instance(system, id, config) {
	var self = this;

	this.firmwareVersion = "0";
	this.firmwareVersionIsOver3 = false; // some commands are only working with firmware >= 3
	this.hasAvailInput7 = false; // not every input is available on every model
	this.hasAvailInput8 = false;
	this.hasAvailInput9 = false;
	this.hasAvailInput10 = false;
	this.hasTwoOutputs = false;

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
	var receivebuffer = '';

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
		});

		// separate buffered stream into lines with responses
		self.socket.on('data', function (chunk) {
			var i = 0, line = '', offset = 0;
			receivebuffer += chunk;
			while ( (i = receivebuffer.indexOf('\r', offset)) !== -1) {
				line = receivebuffer.substr(offset, i - offset);
				offset = i + 1;
				self.socket.emit('receiveline', line.toString());
			}
			receivebuffer = receivebuffer.substr(offset);
		});

		self.socket.on('receiveline', function (line) {
			debug("Received line from PDS:", line);
			// check which device and version we have
			if (line.match(/ShellApp waiting for input/)) self.socket.send("\rVER -?\rIAVAIL -i 7 -?\rIAVAIL -i 8 -?\rIAVAIL -i 9 -?\rIAVAIL -i 10 -?\rOAVAIL -o 3 -?\r");
			if (line.match(/VER \d/)) {
				self.firmwareVersion = line.match(/VER ((?:\d+\.?)+)/)[1];
				if (parseInt(self.firmwareVersion) >= 3) self.firmwareVersionIsOver3 = true;
				debug ("version = ", self.firmwareVersion, " is over 3: ", self.firmwareVersionIsOver3);
			}
			if (line.match(/IAVAIL -i 7 -m 1/)) self.hasAvailInput7 = true;
			if (line.match(/IAVAIL -i 8 -m 1/)) self.hasAvailInput8 = true;
			if (line.match(/IAVAIL -i 9 -m 1/)) self.hasAvailInput9 = true;
			if (line.match(/IAVAIL -i 10 -m 1/)) self.hasAvailInput10 = true;
			if (line.match(/OAVAIL -o 3 -m 1/)) self.hasTwoOutputs = true;
			if (line.match(/-e -\d+/)) {
				switch (parseInt(line.match(/-e -(\d+)/)[1])) {
					case 9999: self.log('error',"Received generic fail error from PDS "+ self.config.label +": "+ line); break;
					case 9998: self.log('error',"PDS "+ self.config.label +" says: Operation is not applicable in current state: "+ line); break;
					case 9997: self.log('error',"Received UI related error from PDS "+ self.config.label +", did not get response from device: "+ line); break;
					case 9996: self.log('error',"Received UI related error from PDS "+ self.config.label +", did not get valid response from device: "+ line); break;
					case 9995: self.log('error',"PDS "+ self.config.label +" says: Timeout occurred: "+ line); break;
					case 9994: self.log('error',"PDS "+ self.config.label +" says: Parameter / data out of range: "+ line); break;
					case 9993: self.log('error',"PDS "+ self.config.label +" says: Searching for data in an index, no matching data: "+ line); break;
					case 9992: self.log('error',"PDS "+ self.config.label +" says: Checksum didn't match: "+ line); break;
					case 9991: self.log('error',"PDS "+ self.config.label +" says: Version didn't match: "+ line); break;
					case 9990: self.log('error',"Received UI related error from PDS "+ self.config.label +", current device interface not supported: "+ line); break;
					case 9989: self.log('error',"PDS "+ self.config.label +" says: Pointer operation invalid: "+ line); break;
					case 9988: self.log('error',"PDS "+ self.config.label +" says: Part of command had error: "+ line); break;
					case 9987: self.log('error',"PDS "+ self.config.label +" says: Buffer overflow: "+ line); break;
					case 9986: self.log('error',"PDS "+ self.config.label +" says: Initialization is not done (still in progress): "+ line); break;
					default: self.log('error',"Received unspecified error from PDS "+ self.config.label +": "+ line);
				}
			}

		});

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
		},{
			type: 'dropdown',
			label: 'Variant',
			id: 'variant',
			default: '1',
			choices: {
				1: 'PDS-701',
				2: 'PDS-901',
				3: 'PDS-902'
			}
		}
	]
};

// When module gets deleted
instance.prototype.destroy = function() {
	var self = this;

	if (self.socket !== undefined) {
		self.socket.destroy();
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
					9: '9 SDI (PDS-701/902 only)',
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
		'ORBM': {
			label: 'Set Rasterbox on/off',
			options: [{
				type: 'dropdown',
				label: 'Output',
				id: 'o',
				default: '1',
				choices: { 1: 'Program', 3: 'Preview'}
			},{
				type: 'dropdown',
				label: 'Rasterbox',
				id: 'm',
				default: '1',
				choices: { 0: 'off', 1: 'on'}
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
			}]},
		'AUTOTAKE': {
			label: 'Set Autotake Mode on/off',
			options: [{
				type: 'dropdown',
				label: 'Autotake',
				id: 'm',
				default: '0',
				choices: { 0: 'off', 1: 'on'}
			}]},
		'PENDPIP': {
			label: 'Pend PiP Mode on/off',
			options: [{
				type: 'dropdown',
				label: 'PiP',
				id: 'p',
				default: '1',
				choices: { 1: 'PiP 1', 2: 'PiP 2'}
			},{
				type: 'dropdown',
				label: 'PiP on/off',
				id: 'm',
				default: '0',
				choices: { 0: 'unpend (no change on Take)', 1: 'pend (PiP on/off on Take)'}
			}]},
		'PIPSEL': {
			label: 'Pend PiP Input',
			options: [{
				type: 'dropdown',
				label: 'PiP',
				id: 'p',
				default: '1',
				choices: { 0: 'All PiPs', 1: 'PiP 1', 2: 'PiP 2'}
			},{
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
					9: '9 SDI (PDS-701/902 only)',
					10: 'Black/Logo'
					}
			}]},

	});
}

instance.prototype.action = function(action) {
	var self = this;

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
	version: '0.0.2'
};

instance_skel.extendedBy(instance);
exports = module.exports = instance;
