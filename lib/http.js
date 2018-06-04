var Express = require('express');
var express = Express();
var _http   = require('http');
var util    = require('util');
var fs 			= require('fs');
var debug   = require('debug')('lib/http');
var path    = require('path');

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

/* External dependencies */
express.use('/js/jquery', Express.static(path.dirname(require.resolve('jquery'))));
express.use('/js/popper', Express.static(path.dirname(require.resolve('popper.js'))));
express.use('/js/bootstrap', Express.static(path.dirname(require.resolve('bootstrap'))));
express.use('/js/bootstrapcp', Express.static(path.dirname(require.resolve('bootstrap-colorpicker'))));
express.use('/js/pace-progress', Express.static(path.dirname(require.resolve('pace-progress'))));
express.use('/js/perfect-scrollbar', Express.static(path.dirname(require.resolve('perfect-scrollbar'))));
express.use('/js/coreui', Express.static(path.dirname(require.resolve('@coreui/coreui'))));
express.use('/js/flag-icon-css', Express.static(require('app-root-path') + '/node_modules/flag-icon-css'));
express.use('/js/font-awesome', Express.static(require('app-root-path') + '/node_modules/font-awesome'));
express.use('/js/moment', Express.static(require('app-root-path') + '/node_modules/moment'));

require('app-root-path') + '';

express.use(function(req, res) {
	debug('404');
	res.redirect('/404.html');
});

function http(system) {
	var self = this;

	_http.Server.call(self, express);

	self.listen_for_http = function() {

		if (self !== undefined && self.close !== undefined) {
			self.close();
		}

		self.on('error', function(e) {
			if (e.code == 'EADDRNOTAVAIL') {
				debug("EADDRNOTAVAIL: " + self.config.bind_ip )
				system.emit('skeleton-ip-unavail');
				system.emit('skeleton-info', 'appURL', self.config.bind_ip + ' unavailable. Select another IP');
				system.emit('skeleton-info', 'appStatus', 'Error');
			}
			else {
				debug(e);
			}
		}).listen(self.config.http_port, self.config.bind_ip, function () {
			debug('new url:', 'http://' + self.address().address + ':' + self.address().port + '/' )
			system.emit('skeleton-info', 'appStatus', 'Running');
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

exports = module.exports = function (system) {
	return new http(system);
};
