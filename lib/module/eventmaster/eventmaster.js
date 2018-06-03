var EventMaster = require('barco-eventmaster');
var checkIp     = require('check-ip');
var ping        = require('ping');
var instance_skel = require('../../instance_skel');
var debug;
var log;

function instance(system, id, config) {
	var self = this;

	// super-constructor
	instance_skel.apply(this, arguments);

	return self;
}

instance.prototype.init = function() {
	var self = this;

	debug = self.debug;
	log = self.log;

	debug('creating eventmaster');

	self.ok = false;
	self.retry_interval = setInterval(self.retry.bind(self), 15000);
	self.retry();
};

instance.prototype.retry = function() {
	var self = this;

	if (self.eventmaster === undefined || (self.config !== undefined && self.config.host !== undefined && self.config.host.match(/^\d+\.\d+\.\d+\.\d+$/)) ) {
		if (self.eventmaster === undefined || (self.eventmaster.ip !== undefined && self.config.host !== self.eventmaster.ip)) {

			var check = checkIp(self.config.host);
			if (check.isValid === true) {
				var cfg = {
					timeout: 4,
				};
				ping.sys.probe(self.config.host, function(isAlive){
					if (isAlive == true) {
						debug("START WITH", self.config.host);
						self.eventmaster = new EventMaster(self.config.host);
						log('Connecting to '+self.config.host)
						debug('host', self.config);
					}
					else {
						log('No ping reply from '+self.config.host+'??')
					}
				}, cfg);
			}
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
			label: 'Target IP',
			width: 6
		}
	]
};

// When module gets deleted
instance.prototype.destroy = function() {
	var self = this;
	clearInterval(self.retry_interval);
	delete self.eventmaster;
	debug("destroy");;
};

instance.prototype.actions = function(system) {
	var self = this;

	var actions = {
		'trans_all': { label: 'Take/Trans Active' },
		'cut_all': { label: 'Cut Active' }
	};

	if (self.eventmaster !== undefined) {
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

		}).on('error', function(err) {
			log('EventMaster Error: '+ err);
		});
	}
}

instance.prototype.action = function(action) {
	var self = this;
	var id = action.action;

	debug('run action:', id);
	if (id.match(/^recall_preset_pvw_id_/)) {
		var ida = id.split(/_/);
		var id = ida[4];
		if (self.eventmaster !== undefined) {
			log('Recall to PVW id:' + id)
			self.eventmaster.activatePresetById(parseInt(id), 0, function(obj, res) {
				debug('recall preset pvw response', res);
			}).on('error', function(err) {
				log('EventMaster Error: '+ err);
			});
		}
	}
	else if (id.match(/^recall_preset_pgm_id_/)) {
		var ida = id.split(/_/);
		var id = ida[4];
		if (self.eventmaster !== undefined) {
			log('Recall to PGM id:' + id)
			self.eventmaster.activatePresetById(parseInt(id), 1, function(obj, res) {
				debug('recall preset pgm response', res);
			}).on('error', function(err) {
				log('EventMaster Error: '+ err);
			});
		}
	}

	else if (id == 'trans_all') {
		log('Trans/Take All');

		if (self.eventmaster !== undefined) {
			self.eventmaster.allTrans(function(obj, res) {
				debug('trans all response', res);
			}).on('error', function(err) {
				log('EventMaster Error: '+ err);
			});

		}
	}

	else if (id == 'cut_all') {
		log('Cut All');

		if (self.eventmaster !== undefined) {
			self.eventmaster.cut(function(obj, res) {
				debug('cut all response', res);
			}).on('error', function(err) {
				log('EventMaster Error: '+ err);
			});
		}
	}

};

instance.module_info = {
	label: 'Barco EventMaster',
	id: 'eventmaster',
	version: '0.0.1'
};

instance_skel.extendedBy(instance);
exports = module.exports = instance;
