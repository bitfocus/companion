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
	self.status(0); // status ok!
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
			tooltip: 'The IP of the computer running Millumin',
			width: 6,
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
	debug("destory", self.id);;
};

instance.prototype.actions = function(system) {
	var self = this;
	self.system.emit('instance_actions', self.id, {
		'tColumn': {
			label: 'Toggle Column (number)',
			options: [
				{
					 type: 'textinput',
					 label: 'Column',
					 id: 'int',
					 default: 1,
					 regex: self.REGEX_NUMBER
				}
			]
		},

		'lColumn': {
			label:'Launch Column (number)',
			options: [
				{
					 type: 'textinput',
					 label: 'Column',
					 id: 'int',
					 default: 1,
					 regex: self.REGEX_NUMBER
				}
			]
		},

		'gotoTlSeg':{
			label:'Goto Timeline Segment (name)',
			options: [
				{
					 type: 'textinput',
					 label: 'Name',
					 id: 'string',
					 default: 'name',
				}
			]
		},

		'normTime': {
			label:'Goto Media Normalized Time (number)',
			options: [
				{
					 type: 'textinput',
					 label: '0.9 = last 10% of media',
					 id: 'float',
					 default: '0.9',
					 regex: self.REGEX_FLOAT
				}
			]
		},

		'startMediaAtColumn': {
			 label: 'Start Media at Column (number)',
			 options: [
				{
				 type: 'textinput',
				 label: 'Column',
				 id: 'int',
				 default: 1,
				 tooltip: 'Column number',
				 regex: self.REGEX_NUMBER
				}
			]
		},

		'startNamedMedia': {
				label:'Start (name) Media',
				options: [
					{
					 type: 'textinput',
					 label: 'Name',
					 id: 'string',
					 default: 'name.mov',
				}
			]
		},

		'nxtColumn':		{ label: 	'Next Column' },
		'prevColumn':		{ label: 	'Previous Column'},
		'stopAll': 			{ label: 	'Stop all Columns' },
		'playTl':				{ label: 	'Play Timeline' },
		'pauseTl':			{ label: 	'Pause Timeline' },
		'tplayTl':			{ label:	'Play or Pause Timeline'},
		'restartMedia': { label: 	'Restart Media'},
		'pauseMedia': 	{ label: 	'Pause Media'},
		'tPlayMedia': 	{ label: 	'Toggle Play Media'},
		'stopMedia': 		{ label: 	'Stop Media'},


	});
}

instance.prototype.action = function(action) {
	var self = this;
	var id = action.action;

	console.log("DETTE ER MIN DEBUG", action);

	var osc = {
		'tColumn':      				'/millumin/action/LaunchOrStopColumn',
		'lColumn':      				'/millumin/action/launchColumn',
		'prevColumn':    				'/millumin/action/launchPreviousColumn',
		'nxtColumn':    				'/millumin/action/launchNextColumn',
		'playTl':       				'/millumin/action/playTimeline',
		'pauseTl':      				'/millumin/action/pauseTimeline',
		'tplayTl':      				'/millumin/action/playOrPauseTimeline',
		'stopAll':      				'/millumin/action/stopColumn',
		'gotoTlSeg':    				'/millumin/action/goToTimelineSegment',
		'normTime':     				'/millumin/selectedLayer/media/normalizedTime',
		'restartMedia': 				'/millumin/selectedLayer/startMedia',
		'pauseMedia':   				'/millumin/selectedLayer/pauseMedia',
		'tPlayMedia':   				'/millumin/selectedLayer/startOrPauseMedia',
		'stopMedia':    				'/millumin/selectedLayer/stopMedia',
		'startMediaAtColumn':		'/millumin/selectedLayer/startMedia',
		'startNamedMedia': 			'/millumin/selectedLayer/startMedia'
	};

	if (id == 'tColumn')  {
		debug('sending ',osc[id],"to",self.config.host);
		var arg = {
			type: "i",
			value: parseInt(action.options.int)
		};
		self.system.emit('osc_send', self.config.host, self.config.port, osc[id], [arg]);
	}

	else if (id == 'lColumn')  {
		debug('sending ',osc[id],"to",self.config.host);
		var arg = {
			type: "i",
			value: parseInt(action.options.int)
		};
		self.system.emit('osc_send', self.config.host, self.config.port, osc[id], [arg]);
	}

	else if (id == 'gotoTlSeg')  {
		debug('sending ',osc[id],"to",self.config.host);
		var arg = {
			type: "s",
			value: "" + action.options.string
		};
		self.system.emit('osc_send', self.config.host, self.config.port, osc[id], [arg]);
	}

	else if (id == 'normTime')  {
		debug('sending ',osc[id],"to",self.config.host);
		var arg = {
			type: "f",
			value: parseFloat(action.options.float)
		};
		self.system.emit('osc_send', self.config.host, self.config.port, osc[id], [arg]);
	}

	else if (id == 'startMediaAtColumn')  {
		debug('sending ',osc[id],"to",self.config.host);
		var arg = {
			type: "i",
			value: parseInt(action.options.int)
		};
		self.system.emit('osc_send', self.config.host, self.config.port, osc[id], [arg]);
	}

	else if (id == 'startNamedMedia')  {
		debug('sending ',osc[id],"to",self.config.host);
		var arg = {
			type: "s",
			value: "" + action.options.string
		};
		self.system.emit('osc_send', self.config.host, self.config.port, osc[id], [arg]);
	}

	else if (osc[id] !== undefined) {
		debug('sending adress only',osc[id],"to",self.config.host);
		self.system.emit('osc_send', self.config.host, self.config.port, osc[id], []);
	}


};

instance.module_info = {
	label: 'Millumin OSC',
	id: 'millumin',
	version: '0.0.2'
};

instance_skel.extendedBy(instance);
exports = module.exports = instance;
