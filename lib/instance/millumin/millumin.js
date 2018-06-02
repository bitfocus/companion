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
};

// Return config fields for web config
instance.prototype.config_fields = function () {
	var self = this;
	return [
		{
			type: 'textinput',
			id: 'host',
			label: 'Target IP',
			width: 6
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
		'tcolumn1': { label: 'Toggle Column 1' },
		'tcolumn2': { label: 'Toggle Column 2' },
		'tcolumn3': { label: 'Toggle Column 3' },
		'tcolumn4': { label: 'Toggle Column 4' },
		'tcolumn5': { label: 'Toggle Column 5' },
		'tcolumn6': { label: 'Toggle Column 6' },
		'tcolumn7': { label: 'Toggle Column 7' },
		'tcolumn8': { label: 'Toggle Column 8' },
		'prvcolumn':{ label: 'Previous Column' },
		'nxtcolumn':{ label: 'Next Column' },
		'playtl':{ label: 'Play Timeline' },
		'pausetl':{ label: 'Pause Timeline' },
		'stopAll': { label: 'Stop all Columns' }

	});
}

instance.prototype.action = function(action) {
	var self = this;
	var id = action.action;

	var osc = {
		'tcolumn1': '/millumin/action/LaunchOrStopColumn',
		'tcolumn2': '/millumin/action/LaunchOrStopColumn',
		'tcolumn3': '/millumin/action/LaunchOrStopColumn',
		'tcolumn4': '/millumin/action/LaunchOrStopColumn',
		'tcolumn5': '/millumin/action/LaunchOrStopColumn',
		'tcolumn6': '/millumin/action/LaunchOrStopColumn',
		'tcolumn7': '/millumin/action/LaunchOrStopColumn',
		'tcolumn8': '/millumin/action/LaunchOrStopColumn',
		'prvcolumn':'/millumin/action/launchPreviousColumn',
		'nxtcolumn':'/millumin/action/launchNextColumn',
		'playtl':'/millumin/action/playTimeline',
		'pausetl':'/millumin/action/pauseTimeline',
		'stopAll': '/millumin/action/stopColumn'

	};
	var args = {
		'tcolumn1': 1,
		'tcolumn2': 2,
		'tcolumn3': 3,
		'tcolumn4': 4,
		'tcolumn5': 5,
		'tcolumn6': 6,
		'tcolumn7': 7,
		'tcolumn8': 8

	};


		if (osc[id] !== undefined && args[id] !== undefined)  {
		debug('sending adress and argument',osc[id] + args[id],"to",self.config.host);
		self.system.emit('osc_send', self.config.host, 5000, osc[id], {
		    type: "i",
		    value: args[id]
		});
	}
		else if (osc[id] !== undefined) {
		debug('sending adress only',osc[id],"to",self.config.host);
		self.system.emit('osc_send', self.config.host, 5000, osc[id], []);
	}


};

instance.module_info = {
	label: 'SuperMillumin',
	id: 'millumin',
	version: '0.0.1'
};

instance_skel.extendedBy(instance);
exports = module.exports = instance;
