var debug   = require('debug')('lib/osc');
var OSC     = require('osc')

function osc(system) {
	var self = this;
	self.ready = true;
	self.system = system;

	self.listener = new OSC.UDPPort({
    localAddress: "0.0.0.0",
    localPort: 12321,
    metadata: true
	});

	self.listener.open();
	self.listener.on("ready", function () {
		self.ready = true;
	});

	self.system.on('osc_send', function(host, port, path, args) {
		self.listener.send({
			address: path,
			args: args
		}, host, port);
	});

	return self;
}

exports = module.exports = function (system) {
	return new osc(system);
};
