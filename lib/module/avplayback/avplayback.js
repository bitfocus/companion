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
		self.udp = new udp(self.config.host, 7000);

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
		'load': {
			label: 'Load Clip (nr)',
			options: [
				{
					 type: 'textinput',
					 label: 'Clip Nr.',
					 id: 'clip',
					 default: 1,
					 regex: self.REGEX_NUMBER
				}
			]
		},

		'playClip': {
			label: 'Play Clip (nr)',
			options: [
				{
					 type: 'textinput',
					 label: 'Clip Nr.',
					 id: 'clip',
					 default: 1,
					 regex: self.REGEX_NUMBER
				}
			]
		},

		'gotoTc': {
			label: 'Goto (TimeCode)',
			options: [
				{
					 type: 'textinput',
					 label: 'hh:mm:ss:ff',
					 id: 'tc',
					 default: '00:00:00:00',
					 regex: self.REGEX_TIMECODE
				}
			]
		},

		'play': 		{ label: 'Play standby clip' },
		'pause': 		{ label: 'Pause Resume' },
		'stop': 		{ label: 'Stop' },
		'freeze': 	{ label: 'Freeze temp' },
		'loop': 		{ label: 'Loop temp' },
		'10': 			{ label: 'Goto 10' },
		'20': 			{ label: 'Goto 20' },
		'30': 			{ label: 'Goto 30' },
		'60': 			{ label: 'Goto 60' }
	});
};

instance.prototype.action = function(action) {
	var self = this;
	var id = action.action;

	// avplayback port 7000
	var avplayback = {
		'load':				'AVP|1|LoadClip,',
		'playClip':		'AVP|1|start,',
		'play': 			'AVP|1|Start,-1',
		'pause': 			'AVP|1|Pause',
		'stop': 			'AVP|1|Stop',
		'freeze': 		'AVP|1|TmpHold',
		'loop': 			'AVP|1|TmpLoop',
		'gotoTc':			'AVP|1|SetPosition,',
		'10': 				'AVP|1|GotoTimeOut,4',
		'20': 				'AVP|1|GotoTimeOut,3',
		'30': 				'AVP|1|GotoTimeOut,2',
		'60': 				'AVP|1|GotoTimeOut,1'
	};

	if (id == 'load') {

		// TODO: remove this when issue #71 is fixed
		if (self.udp === undefined && self.config.host) {
			self.udp = new udp(self.config.host, 7000);

			self.udp.on('status_change', function (status, message) {
				self.status(status, message);
			});
		}

		if (self.udp !== undefined) {

			if (self.udp.host != self.config.host) {
				// TODO: remove this when issue #71 is fixed
				self.udp.unload();
				self.udp = new udp(self.config.host, 7000);
			}
			debug('sending with arguments',avplayback[id] + action.options.clip,"to",self.udp.host);

			self.udp.send(avplayback[id] + action.options.clip);
		}
	}

	else if (id == 'playClip') {

		// TODO: remove this when issue #71 is fixed
		if (self.udp === undefined && self.config.host) {
			self.udp = new udp(self.config.host, 7000);

			self.udp.on('status_change', function (status, message) {
				self.status(status, message);
			});
		}

		if (self.udp !== undefined) {

			if (self.udp.host != self.config.host) {
				// TODO: remove this when issue #71 is fixed
				self.udp.unload();
				self.udp = new udp(self.config.host, 7000);
			}
			debug('sending with arguments',avplayback[id] + action.options.clip,"to",self.udp.host);

			self.udp.send(avplayback[id] + action.options.clip);
		}
	}

	else if (id == 'gotoTc') {

		// TODO: remove this when issue #71 is fixed
		if (self.udp === undefined && self.config.host) {
			self.udp = new udp(self.config.host, 7000);

			self.udp.on('status_change', function (status, message) {
				self.status(status, message);
			});
		}

		if (self.udp !== undefined) {

			if (self.udp.host != self.config.host) {
				// TODO: remove this when issue #71 is fixed
				self.udp.unload();
				self.udp = new udp(self.config.host, 7000);
			}

			debug('sending with arguments',avplayback[id] + action.options.tc,"to",self.udp.host);

			self.udp.send(avplayback[id] + action.options.tc);
		}
	}


	else if (id !== undefined){

		// TODO: remove this when issue #71 is fixed
		if (self.udp === undefined && self.config.host) {
			self.udp = new udp(self.config.host, 7000);

			self.udp.on('status_change', function (status, message) {
				self.status(status, message);
			});
		}

		if (self.udp !== undefined) {

			if (self.udp.host != self.config.host) {
				// TODO: remove this when issue #71 is fixed
				self.udp.unload();
				self.udp = new udp(self.config.host, 7000);
			}

			debug('sending normal',avplayback[id],"to",self.udp.host);

			self.udp.send(avplayback[id]);
		}
	}
};

instance.module_info = {
	label: 'AV-Playback UDP',
	id: 'avplayback',
	version: '0.0.1'
};

instance_skel.extendedBy(instance);
exports = module.exports = instance;
