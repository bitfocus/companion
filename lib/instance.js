var system;
var debug   = require('debug')('lib/instance');
var shortid = require('shortid');

function instance(system) {
	var self = this;
	self.system = system;
	self.active = {};
	self.store = {
		module: [
			{ label: 'Barco EventMaster', id: 'eventmaster' },
			{ label: 'Mitti', id: 'mitti' },
			{ label: 'dısguıse (d3)', id: 'disguise' },
			{ label: 'Qlab', id: 'qlab' }
		],
		db: {
		}
	};

	self.system.on('instance_init', function() {

		debug('instance_init', self.store.db);

		for (var id in self.store.db) {
			var config = self.store.db[id];
			var req = require('./instance/'+config.instance_type);
			self.active[id] = new req(self.system, id, config);
		}

	});

	system.emit('db_get', 'instance', function(res) {
		if (res === undefined) {
			self.store.db = {};
		}
		else {
			console.log("loading:", res);
			self.store.db = res;
		}
		system.emit('instance_init');
	})

	system.emit('io_get', function(io) {
		self.io = io;
		io.on('connect', function(client) {
			self.connect(client);
		});
	});

	system.on('instance_save', function(){
		system.emit('db_set', 'instance', self.store.db);
		system.emit('db_save');
	});

	system.on('action_run', function(instance, action) {

		if (self.active[instance] !== undefined) {
			self.active[instance].action(action);
		}

		else {
			debug("trying to run action on a deleted instance.",instance, action)
		}

	});

	return self;
}

instance.prototype.connect = function (client) {
	var self = this;

	client.on('instance_get', function() {
		client.emit('instance', self.store);
	});

	client.on('instance_edit', function(id) {
		var res = self.active[id].config_fields();

		res.unshift({
			type: 'textinput',
			id: 'label',
			label: 'Label',
			width: 12
		});

		client.emit(
			'instance_edit:result',
			id,
			self.store,
			res,
			self.store.db[id]
		);

		self.system.emit('instance_save');

	});

	client.on('instance_config_set', function(id, key, val) {
		self.store.db[id][key] = val;
		self.system.emit('instance_save');
		console.log('hallo config for faen',id,key,val);
		self.io.emit('instance_db_update', self.store.db);
	});

	client.on('instance_delete', function(id) {
		self.system.emit('instance_delete', id);
		self.active[id].destroy();
		delete self.active[id];
		delete self.store.db[id];
		self.system.emit('instance_save');
	});

	client.on('instance_add', function(module) {
		var req = require('./instance/'+module);
		var id = shortid.generate();
		self.store.db[id] = {};

		try {
			self.active[id] = new req(self.system, id, self.store.db[id]);
		} catch(e) {
			debug("INSTANCE ADD EXCEPTION:", e);
		}

		self.store.db[id].instance_type = module;
		self.store.db[id].label = module;
		self.io.emit('instance_add:result', id, self.store.db);
		debug('instance_add', id);
		self.system.emit('instance_save');
		self.system.emit('actions_update')
	});

};

exports = module.exports = function (system) {
	return new instance(system);
};
