var debug   = require('debug')('lib/rest');
var Client  = require('node-rest-client').Client;

function rest(system) {
	var self = this;
	self.system = system;

	system.on('rest', function(url, data, cb) {

		debug('making request:', url, data);

		var client = new Client();

		var args = {
				data: data,
				headers: { "Content-Type": "application/json" }
		};

		client.post(url, args, function (data, response) {
			debug('success response:', data, response);
			cb(null, { data: data, response: response });
		}).on('error', function(error) {
			debug('error response:', error);
			cb(true, { error: error });
		});

	});

	return self;
}

exports = module.exports = function (system) {
	return new rest(system);
};
