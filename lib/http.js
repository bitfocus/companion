var Express = require('express');
var express = Express();
var _http   = require('http');
var util    = require('util');
var fs 			= require('fs');
var debug   = require('debug')('lib/http');

var system;

var maxAge = process.env.PRODUCTION ? 3600000 : 0;

express.use(function(req, res, next) {
	res.set('X-App', 'Bitfocus AS');
	next();
});

express.use(Express.static(__dirname + '/../public', {
	dotfiles: 'ignore',
	etag: true,
	extensions: [
		'htm',
		'html'
	],
	index: 'index.html',
	maxAge: maxAge,
	redirect: false
}));

express.use(function(req, res) {
	debug('404');
	res.redirect('/404.html');
});

function http(system, port) {
	var self = this;

	_http.Server.call(self, express);

	self.listen_for_http = function() {

		debug("listen_for_http("+self.config.http_port+","+self.config.bind_ip+")");

		if (self !== undefined && self.close !== undefined) {
			self.close();
		}

		self.on('error', function(e) {
			if (e.code == 'EADDRNOTAVAIL') {
				debug("EADDRNOTAVAIL: " + self.config.bind_ip )
				system.emit('skeleton-ip-unavail');
				system.emit('skeleton-info', 'appURL', self.config.bind_ip + ' unavailable. Select another IP');
			}
			else {
				debug(e);
			}
		}).listen(self.config.http_port, self.config.bind_ip, function () {
			debug('new url:', 'http://' + self.address().address + ':' + self.address().port + '/' )
			system.emit('skeleton-info', 'appURL', 'http://' + self.address().address + ':' + self.address().port + '/');
		});
	}

	system.emit('config_object', function(config) {
		self.config = config;
		system.on('ip_rebind', self.listen_for_http);
		self.listen_for_http();
	});

	// Handle 404 - Keep this as a last route
	express.use(function(req, res, next) {
		res.status(404);
		self.log('debug', "404 " + req.url);
		res.send("404");
	});

	return self;

}
util.inherits(http, _http.Server);

http.prototype.log = function () {
	var self = this;
	var args = Array.prototype.slice.call(arguments);
	args.unshift('log', 'http');
	debug(args);
};


//exports = module.exports = http;

exports = module.exports = function (system, port) {
	return new http(system, port);
};
