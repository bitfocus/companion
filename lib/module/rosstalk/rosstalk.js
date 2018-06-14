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
		self.socket = new tcp(self.config.host, 7788);

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
			label: 'Mixer IP',
			width: 6,
			regex: self.REGEX_IP
		},
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

		'gpi': {
			label:'Trigger GPI',
			options: [
				{
					 type: 'textinput',
					 label: 'Number',
					 id: 'gpi',
					 default: '1',
					 regex: self.REGEX_NUMBER
				}
			]
		},

		'cc': {
			label:'Fire custom control',
			options: [
				{
					 type: 'textinput',
					 label: 'CC Bank',
					 id: 'bank',
					 default: '1',
					 regex: self.REGEX_NUMBER
				},
				{
					 type: 'textinput',
					 label: 'CC Number',
					 id: 'cc',
					 default: '1',
					 regex: self.REGEX_NUMBER
				}
			]
		},

		'loadset': {
			label:'Load Set',
			options: [
				{
					type: 'textinput',
					label: 'Set name',
					id: 'set',
					default: 'set1',
				}
			]
		},

		'cut': {
			label:'Cut',
			options: [
				{
					type: 'textinput',
					label: 'MLE',
					id: 'mle',
					default: 'ME:1',
				}
			]
		},

		'autotrans': {
			label:'Auto Transition',
			options: [
				{
					type: 'textinput',
					label: 'MLE',
					id: 'mle',
					default: 'ME:1',
				}
			]
		},

		'xpt': {
			label:'XPT',
			options: [
				{
					type: 'textinput',
					label: 'Destination',
					id: 'vidDest',
					default: 'ME:1:PGM',
					tooltip: 'Program - ME:(ME-number):PGM, AuxBus — AUX:(aux-number), Key — ME:(ME-number):KEY:(key-number), MiniME™ — MME:(ME-number), Preset — ME:(ME-number):PST'
				},
				{
					type: 'textinput',
					label: 'Source',
					id: 'vidSource',
					default: 'IN:20',
					tooltip: 'Aux Bus — AUX:(aux-number), Black — BK, Clean — ME:(ME-number):CLN, Input Source — IN:(input-number), Key — ME:(ME-number):KEY:(key-number), Matte Color — BG, Media-Store — MS:(channel-number), MiniME™ — MME:(ME-number), Preview — ME:(ME-number):PV, Program — ME:(ME-number):PGM, XPression Alpha — XP:(channel-number):A [Graphite only], XPression Video — XP:(channel-number):V [Graphite only], Chroma Key Video — CK:(chroma key number) [UltraChromeHR, or Carbonite Black v14.0 or higher only], Chroma Key Alpha — CKA:(chroma key number) [UltraChromeHR, or Carbonite Black v14.0 or higher only]'
				}
			]
		},

		'transKey': {
			label:'Transition Keyer',
			options: [
				{
					type: 'textinput',
					label: 'MLE',
					id: 'mle',
					default: 1,
					regex: self.REGEX_NUMBER
				},
				{
					type: 'textinput',
					label: 'Keyer',
					id: 'key',
					default: 1,
					regex: self.REGEX_NUMBER
				},
				{
					type: 'dropdown',
					label: 'Auto Transition',
					id: 'autoTrans',
					default: 'false',
					choices: self.CHOICES_YESNO_BOOLEAN
				}
			]
		},

		'ftb':		{ label: 	'Fade to black' }

	});
}

instance.prototype.action = function(action) {
	var self = this;
	var id = action.action;

	// parseInt(action.options.int)
	var cmd;

	switch (action.action) {

		case 'gpi':
			var gpi = parseInt(action.options.gpi);
			cmd = 'GPI ' + (gpi > 9 ? '' : '0') + gpi;
			break;

		case 'cc':
			var cc = parseInt(action.options.cc);
			cmd = 'CC ' + parseInt(action.options.bank) + ':' + (cc > 9 ? '' : '0') + cc;
			break;

		case 'xpt':
			var src = action.options.vidSource;
			var dst = action.options.vidDest;
			cmd = 'XPT ' + dst + ':' + src;
			console.log('ross xpt:', cmd);
			break;

		case 'ftb':
			cmd = 'FTB';
			break;

		case 'loadset':
			cmd = 'LOADSET ' + action.options.set;
			break;

		case 'cut':
			cmd = 'MECUT ' + action.options.mle;
			break;

		case 'autotrans':
			cmd = 'MEAUTO ' + action.options.mle;
			break;

	}

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
			self.socket.send(cmd + "\n");
		} else {
			debug('Socket not connected :(');
		}

	}

	debug('action():', action);


};

instance.module_info = {
	label: 'ROSS Carbonite/Vision',
	id: 'rosstalk',
	version: '0.0.2'
};

instance_skel.extendedBy(instance);
exports = module.exports = instance;
