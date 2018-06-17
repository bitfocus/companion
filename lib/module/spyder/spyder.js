var instance_skel = require('../../instance_skel');
var udp           = require('../../udp');
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

	self.status(self.STATUS_UNKNOWN);

	if (self.config.host !== undefined) {
		self.udp = new udp(self.config.host, 11116);

		self.udp.on('status_change', function (status, message) {
			self.status(status, message);
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
			label: 'Target IP',
			width: 6,
			regex: self.REGEX_IP
		}
	]
};

// When module gets deleted
instance.prototype.destroy = function() {
	var self = this;

	if (self.udp !== undefined) {
		self.udp.destroy();
	}
	debug("destroy", self.id);
};

instance.prototype.actions = function(system) {
	var self = this;

	self.system.emit('instance_actions', self.id, {
		'bpr': {
			label: 'Basic Preset Recall (Index Nr)',
			options: [
				{
					 type: 'textinput',
					 label: 'Preset Index',
					 id: 'idx',
					 default: 1,
					 regex: self.REGEX_NUMBER
				},
				{
					type: 'textinput',
					label: 'Duration (Optional)',
					id: 'dur',
					default: 1,
					regex: self.REGEX_NUMBER
				}

			]
		},

		'rsc': {
			label: 'Recall Script Cue (Script, Cue)',
			options: [
				{
					 type: 'textinput',
					 label: 'Script ID',
					 id: 'sidx',
					 default: 1,
					 regex: self.REGEX_NUMBER
				},
				{
					type: 'textinput',
					label: 'Cue ID',
					id: 'cidx',
					default: 1,
					regex: self.REGEX_NUMBER
				}
			]
		},

		'trn': {
			label: 'Transition layer(s)',
			options: [
				{
					type: 'dropdown',
				 	label: 'Transition Mix on/off',
					id: 'mix',
					default: '1',
					choices: { 1: 'Mix On', 0: 'Mix Off' }
				},
				{
					type: 'textinput',
					label: 'duration',
					id: 'dur',
					default: 60,
					regex: self.REGEX_NUMBER
				},
				{
					type: 'textinput',
					label: 'Layer(s) input multiple layers space delimited',
					id: 'lay',
					default: ''
				}
			]
		},

		'frz':	{
			label: 'Freeze Layer(s)',
			options:[
				{
					type: 'dropdown',
				 	label: 'Freeze Layer on/off',
					id: 'frzonoff',
					default: '1',
					choices: { 1: 'Freeze On', 0: 'Freeze Off' }
				},
				{
					type: 'textinput',
					label: 'Layer(s) input multiple layers space delimited',
					id: 'lay',
					default: 1
				}
			]
		},

		'btr':	{
			label: 'Background Transition',
		 	options:[
				{
					type: 'textinput',
					label: 'duration',
					id: 'dur',
					default: 60,
					regex: self.REGEX_NUMBER
				}
			]
		},

		'fkr':	{
			label: 'Function Key Recall',
			options:[
				{
					type: 'textinput',
					label: 'Funktion key ID',
					id: 'fkrid',
					default: 1,
					regex: self.REGEX_NUMBER
				},
				{
					type: 'textinput',
					label: 'Layer(s) input multiple layers space delimited',
					id: 'lay',
					default: 1
				}
			]
		},

		'ofz':	{
			label: 'Output Freeze',
			options:[
				{
					type: 'dropdown',
				 	label: 'Freeze Output on/off',
					id: 'frzonoff',
					default: '1',
					choices: { 1: 'Freeze On', 0: 'Freeze Off' }
				},
				{
					type: 'textinput',
					label: 'Output(s)input multiple outputs space delimited',
					id: 'output',
					default: 1
				}
			]
		 },

		'dmt':	{
			 label: 'Device Mixer Transition',
			 options:[
				 {
					type: 'textinput',
 					label: 'duration',
 					id: 'dur',
 					default: 60,
 					regex: self.REGEX_NUMBER
				 },
				 {
					type: 'textinput',
 					label: 'Device(s)',
 					id: 'dev',
 					default: 1
				 }
			 ]
		  },

	});
}


instance.prototype.action = function(action) {
	var self = this;
	var id = action.action;
	var cmd;
	var opt = action.options;
	// spyder port 11116

	switch (action.action) {

		case 'bpr':
			cmd = 'spyder\\x00\\x00\\x00\\x00bpr' +' '+ opt.idx +' '+  opt.dur;
			break;

		case 'rsc':
			cmd = 'spyder\\x00\\x00\\x00\\x00rsc' +' '+ opt.sidx +' '+ opt.cidx;
			break;

		case 'trn':
			cmd = 'spyder\\x00\\x00\\x00\\x00trn' +' '+ opt.mix +' '+ opt.dur +' '+ opt.lay;
			break;

		case 'frz':
			cmd = 'spyder\\x00\\x00\\x00\\x00frz' +' '+ opt.frzonof +' '+ opt.lay;
			break;

		case 'btr':
			cmd = 'spyder\\x00\\x00\\x00\\x00btr' +' '+ opt.dur;
			break;

		case 'fkr':
			cmd = 'spyder\\x00\\x00\\x00\\x00fkr' +' '+ opt.fkrid +' '+ opt.lay;
			break;

		case 'ofz':
			cmd = 'spyder\\x00\\x00\\x00\\x00ofz' +' '+ opt.frzonoff +' '+ opt.output;
			break;

		case 'dmt':
			cmd = 'spyder\\x00\\x00\\x00\\x00dmt' +' '+ opt.dur +' '+ opt.dev;
			break

	}

	if (cmd !== undefined) {

		// TODO: remove this when issue #71 is fixed
		if (self.udp === undefined && self.config.host) {
			self.udp = new udp(self.config.host, 11116);

			self.udp.on('status_change', function (status, message) {
				self.status(status, message);
			});
		}

		if (self.udp !== undefined) {

			if (self.udp.host != self.config.host) {
				// TODO: remove this when issue #71 is fixed
				self.udp.unload();
				self.udp = new udp(self.config.host, 11116);
			}
			debug( "Sending ",cmd,"to",self.udp.host);

			self.udp.send(cmd);
		}
	}

	debug('action():', action);

};

instance.module_info = {
	label: 'Spyder UDP',
	id: 'spyder',
	version: '0.0.2'
};

instance_skel.extendedBy(instance);
exports = module.exports = instance;
