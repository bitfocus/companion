var debug   = require('debug')('lib/instance/eventmaster');
var EventMaster = require('barco-eventmaster');

function instance(system, id, config) {
	var self = this;

	debug('creating eventmaster');
	self.system = system;
	self.id = id;
	self.config = config;
	self.ok = false;
	self.retry_interval = setInterval(self.retry.bind(self), 15000);
	self.retry();
	return self;
}

instance.prototype.retry = function() {
	var self = this;

	if (self.eventmaster === undefined || (self.config !== undefined && self.config.host !== undefined && self.config.host.match(/^\d+\.\d+\.\d+\.\d+$/)) ) {
		if (self.eventmaster === undefined || (self.eventmaster.ip !== undefined && self.config.host !== self.eventmaster.ip)) {
			self.eventmaster = new EventMaster(self.config.host);
			self.system.emit('skeleton-log', 'EventMaster: Connecting to '+self.config.host)
			console.log('host', self.config);
		}
	}
	self.actions();
}

// Return config fields for web config
instance.prototype.config_fields = function () {
	var self = this;
	return [
		{
			type: 'textinput',
			id: 'host',
			label: 'E2/S3 IP',
			width: 6
		}
	]
};

// When module gets deleted
instance.prototype.destroy = function() {
	var self = this;
	clearInterval(self.retry_interval);
	delete self.eventmaster;
	debug("destory", self.id);;
};

instance.prototype.actions = function(system) {
	var self = this;

	self.system.emit('skeleton-log', 'EventMaster: Fetching presets')

	var actions = {
		'trans_all': { label: 'Take/Trans Active' },
		'cut_all': { label: 'Cut Active' }
	};


	self.eventmaster.listPresets(-1, -1, function(obj, res) {
		if (res !== undefined) {
			for (var n in res) {
				var preset = res[n];
				var p_name = 'Recall preset in PVW: ' + preset.Name;
				var pg_name = 'Recall preset in PGM: ' + preset.Name;
				var	p_id = 'recall_preset_pvw_id_' + preset.id;
				var	pg_id = 'recall_preset_pgm_id_' + preset.id;

				actions[p_id] = { label: p_name };
				actions[pg_id] = { label: pg_name };

			}
		}
		self.system.emit('instance_actions', self.id, actions);
	});

}

instance.prototype.action = function(id) {
	var self = this;

	debug('run action:', id);
	if (id.match(/^recall_preset_pvw_id_/)) {
		var ida = id.split(/_/);
		var id = ida[4];
		if (self.eventmaster !== undefined) {
			self.system.emit('skeleton-log', 'EventMaster: Recall to PVW id:' + id)
			self.eventmaster.activatePresetById(parseInt(id), 0, function(obj, res) {
				debug('recall preset pvw response', res);
			});
		}
	}
	else if (id.match(/^recall_preset_pgm_id_/)) {
		var ida = id.split(/_/);
		var id = ida[4];
		if (self.eventmaster !== undefined) {
			self.system.emit('skeleton-log', 'EventMaster: Recall to PGM id:' + id)
			self.eventmaster.activatePresetById(parseInt(id), 1, function(obj, res) {
				debug('recall preset pgm response', res);
			});
		}
	}

	else if (id == 'trans_all') {
		self.system.emit('skeleton-log', 'EventMaster: Trans/Take All');
		if (self.eventmaster !== undefined) {
			self.eventmaster.allTrans(function(obj, res) {
				debug('trans all response', res);
			});

		}
	}

	else if (id == 'cut_all') {
		self.system.emit('skeleton-log', 'EventMaster: Cut All');
		if (self.eventmaster !== undefined) {
			self.eventmaster.cut(function(obj, res) {
				debug('cut all response', res);
			});
		}
	}



};

exports = module.exports = function (system, id, config) {
	debug('creating eventmaster');
	return new instance(system, id, config);
};
