var system;
var debug   = require('debug')('lib/instance');
var shortid = require('shortid');

function instance(system) {
	var self = this;
	self.system = system;
	self.active = {};
	self.store = {
		module: [
			{ label: 'Dummy', id: 'dummy' }
		],
		db: {
		}
	};

	system.on('instance_init', function() {

		debug('instance_init', self.store.db);

		for (var id in self.store.db) {
			var config = self.store.db[id];
			var req = require('./instance/'+config.instance_type);
			self.active[id] = new req(system, id, config);
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
		debug('db_get', res);
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
			width: 6
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
		debug('config_set', id,key,val);
		self.store.db[id][key] = val;
		self.system.emit('instance_save');
	});

	client.on('instance_delete', function(id) {
		self.active[id].destroy();
		delete self.active[id];
		delete self.store.db[id];
		self.system.emit('instance_save');
	});

	client.on('instance_add', function(module) {
		var req = require('./instance/'+module);
		var id = shortid.generate();
		console.log("req:", id);
		self.active[id] = new req(system, id, null);
		self.store.db[id] = { instance_type: module }
		self.io.emit('instance_add:result', id);
		debug('instance_add', id);
		self.system.emit('instance_save');
	});

};

exports = module.exports = function (system) {
	return new instance(system);
};
