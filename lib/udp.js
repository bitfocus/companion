var debug   = require('debug')('lib/udp');
var UDP     = require('dgram');

function udp(system) {
	var self = this;
	self.ready = true;
	self.system = system;

	debug('init');

	// check udp status
	//self.interval = setInterval(self.connect.bind(self), 1000);

	self.system.on('udp_send', function(host, port, message, cb) {
		debug('sending ' + (message !== undefined ? message.length : 'undefined') + ' bytes to', host, port)
		var client = UDP.createSocket('udp4');
		client.send(message, port, host, function(error){
			client.close();
			cb(error);
		});
	});

	return self;
}

udp.prototype.connect = function() {
	var self = this;
}


exports = module.exports = function (system) {
	return new udp(system);
};
