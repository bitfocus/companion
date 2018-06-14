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

	// spyder port 11116
	var spyder = {
		'bpr':        'spyder\\x00\\x00\\x00\\x00bpr',
		'rsc':        'spyder\\x00\\x00\\x00\\x00rsc',
		'trn':        'spyder\\x00\\x00\\x00\\x00trn',
		'frz':        'spyder\\x00\\x00\\x00\\x00frz',
		'btr':        'spyder\\x00\\x00\\x00\\x00btr',
		'fkr':        'spyder\\x00\\x00\\x00\\x00fkr',
		'ofz':        'spyder\\x00\\x00\\x00\\x00ofz',
		'dmt':        'spyder\\x00\\x00\\x00\\x00dmt',
	};

	if (id == 'bpr') {

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
		 	debug( "Sending ",spyder[id] ,' ',action.options.idx,' ', action.options.dur, "to",self.udp.host);

			self.udp.send(spyder[id] + ' ' + action.options.idx + ' ' + action.options.dur);
		}
	}

	else if (id == 'rsc') {

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
			debug('Sending ',spyder[id],' ',action.options.sidx,' ',action.options.cidx," to",self.udp.host);

			self.udp.send(spyder[id] + ' ' + action.options.sidx + ' ' + action.options.cidx);
		}
	}

	else if (id == 'trn') {

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

			debug('sending',spyder[id],' ',action.options.mix,' ',action.options.dur,' ',action.options.lay," to",self.udp.host);
			self.udp.send(spyder[id] + ' '+ action.options.mix + ' ' + action.options.dur + ' ' + action.options.lay);
		}
	}

	else if (id == 'frz') {

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

			debug('sending',spyder[id],' ',action.options.frzonoff,' ',action.options.lay," to",self.udp.host);
			self.udp.send(spyder[id] + ' ' + action.options.frzonoff + ' ' + action.options.lay);
		}
	}

	else if (id == 'btr') {

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

			debug('sending',spyder[id],' ',action.options.dur," to",self.udp.host);
			self.udp.send(spyder[id] + ' ' + action.options.dur);
		}
	}

	else if (id == 'fkr') {

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

			debug('sending',spyder[id],' ',action.options.fkrid, ' ', action.options.lay," to",self.udp.host);
			self.udp.send(spyder[id] + ' ' + action.options.fkrid + ' ' + action.options.lay);
		}
	}

	if (id == 'ofz') {

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
			debug( "Sending ",spyder[id] ,' ',action.options.frzonoff,' ', action.options.output, "to",self.udp.host);

			self.udp.send(spyder[id] + ' ' + action.options.frzonoff + ' ' + action.options.output);
		}
	}

	if (id == 'dmt') {

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
			debug( "Sending ",spyder[id] ,' ',action.options.dur,' ', action.options.dev, "to",self.udp.host);

			self.udp.send(spyder[id] + ' ' + action.options.dur + ' ' + action.options.dev);
		}
	}


	else if (id !== undefined){

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

			//debug('sending normal',spyder[id],"to",self.udp.host);

			//self.udp.send(spyder[id]);
		}
	}
};

instance.module_info = {
	label: 'Spyder UDP',
	id: 'spyder',
	version: '0.0.1'
};

instance_skel.extendedBy(instance);
exports = module.exports = instance;
