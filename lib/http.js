var Express = require('express');
var express = Express();
var _http   = require('http');
var util    = require('util');
var fs 			= require('fs');

var system;

var maxAge = process.env.PRODUCTION ? 3600000 : 0;

express.use(function(req, res, next) {
	res.set('X-App', 'Bitfocus');
	next();
});

express.use(Express.static('./public', {
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

function http(system, port) {
	var self = this;

	_http.Server.call(self, express);

	system.on('config_loaded', function(config) {
		self.listen(config.http_port, config.http_bind, function () {
			system.emit('http_listening', self.address().address, self.address().port);
		});
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
	console.log(args);
};

exports = module.exports = function (system, port) {
	return new http(system, port);
};
