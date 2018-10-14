/*
 * This file is part of the Companion project
 * Copyright (c) 2018 Bitfocus AS
 * Authors: William Viker <william@bitfocus.io>, Håkon Nessjøen <haakon@bitfocus.io>
 *
 * This program is free software.
 * You should have received a copy of the MIT licence as well as the Bitfocus
 * Individual Contributor License Agreement for companion along with
 * this program.
 *
 * You can be released from the requirements of the license by purchasing
 * a commercial license. Buying such a license is mandatory as soon as you
 * develop commercial activities involving the Companion software without
 * disclosing the source code of your own applications.
 *
 */

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

function http(system) {
	var self = this;

	_http.Server.call(self, express);

	self.listen_for_http = function() {

		if (self !== undefined && self.close !== undefined) {
			self.close();
		}
		try {
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
		} catch(e) {
			debug("http bind error", e);
		}
	}

	system.emit('config_object', function(config) {
		self.config = config;
		system.on('ip_rebind', self.listen_for_http);
		self.listen_for_http();
	});

	express.use('/int', function (req, res, next) {
		var handeled = false;

		var timeout = setTimeout(function () {
			handeled = true;
			next();
		}, 2000);

		system.emit('http_req', req, res, function () {
			if (!handeled) {
				clearTimeout(timeout);
				handeled = true;
			}
		});
	});
	express.get( '^/press/bank/:page([0-9]{1,2})/:bank([0-9]{1,2})', function (req, res) {

		debug("Got HTTP /press/bank/ (trigger) page ",req.params.page,"button",req.params.bank);
		system.emit('bank-pressed', req.params.page, req.params.bank, true);

		setTimeout(function (){
			debug("Auto releasing HTTP /press/bank/ page ",req.params.page,"button",req.params.bank);
			system.emit('bank-pressed', req.params.page, req.params.bank, false);
		}, 20);

		res.send( 'ok' );
	});

	express.get( '^/press/bank/:page([0-9]{1,2})/:bank([0-9]{1,2})/:direction(down|up)', function (req, res) {

		if (req.params.direction == 'down') {
			debug("Got HTTP /press/bank/ (DOWN) page ",req.params.page,"button",req.params.bank);
			system.emit('bank-pressed', req.params.page, req.params.bank, true);
		}
		else {
			debug("Got HTTP /press/bank/ (UP) page ",req.params.page,"button",req.params.bank);
			system.emit('bank-pressed', req.params.page, req.params.bank, false);
		}

		res.send( 'ok' );
	});

	express.use(function(req, res) {
		debug('404', req.url);
		res.status(404);
		res.sendFile(path.resolve(__dirname + '/../public/404.html'));
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
