var system;

function instance(system) {
	var self = this;

	self.store = {
		module: [
			{ label: 'Barco EventMaster', id: 'barco_em' },
			{ label: 'Dummy', id: 'dummy' },
		],
		db: {}
	};

	system.emit('io_get', function(io) {
		io.on('connect', function(client) {
			self.connect(client);
		});
	});

	return self;
}

instance.prototype.connect = function (client) {
	var self = this;

	client.on('instance_get', function() {
		client.emit('instance', self.store);
	});

	client.on('instance_add', function(id) {

	});

};

exports = module.exports = function (system) {
	return new instance(system);
};
