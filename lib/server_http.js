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

var Express    = require('express');
var { Server } = require('http');
var fs         = require('fs');
var debug      = require('debug')('lib/server_http');
var path       = require('path');
var root       = require('app-root-path');

var maxAge = process.env.PRODUCTION ? 3600000 : 0;

class CompanionExpress extends Express {

	constructor() {
		super();

		this.use(function(req, res, next) {
			res.set('X-App', 'Bitfocus AS');
			next();
		});

		this.use(Express.static(path.join(__dirname, '/../public'), {
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

		this.express.use('/v2', Express.static(path.join(__dirname, '/../webui/build'), {
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
		this.use('/js/jquery', Express.static(path.dirname(require.resolve('jquery'))));
		this.use('/js/popper', Express.static(path.dirname(require.resolve('popper.js'))));
		this.use('/js/bootstrap', Express.static(path.dirname(require.resolve('bootstrap'))));
		this.use('/js/bootstrapcp', Express.static(path.dirname(require.resolve('bootstrap-colorpicker'))));
		this.use('/js/pace-progress', Express.static(path.dirname(require.resolve('pace-progress'))));
		this.use('/js/perfect-scrollbar', Express.static(path.dirname(require.resolve('perfect-scrollbar'))));
		this.use('/js/coreui', Express.static(path.dirname(require.resolve('@coreui/coreui'))));
		this.use('/js/flag-icon-css', Express.static(root + '/node_modules/flag-icon-css'));
		this.use('/js/font-awesome', Express.static(root + '/node_modules/font-awesome'));
		this.use('/js/moment', Express.static(root + '/node_modules/moment'));
		this.use('/select2', Express.static(root + '/node_modules/select2/dist'));
		this.use('/tributejs', Express.static(root + '/node_modules/tributejs/dist'));

		if (process.env.DEVELOPER !== undefined) {
			express.use('/js/dist', Express.static(require('app-root-path') + '/public/js/babel'));
		}
  }
}

class server_http extends Server {

	constructor(system, express) {
		super(express);

		this.system = system;
		this.express = express;

		this.system.emit('config_object', (config) => {
			this.config = config;
			this.system.on('ip_rebind', this.listenForHttp);
			this.listenForHttp();
		});

		this.express.use('/int', (req, res, next) => {
			var handeled = false;

			var timeout = setTimeout(() => {
				handeled = true;
				next();
			}, 2000);

			this.system.emit('http_req', req, res, () => {
				if (!handeled) {
					clearTimeout(timeout);
					handeled = true;
				}
			});
		});

		this.express.options("/press/bank/*", (req, res, next) => {
			res.header('Access-Control-Allow-Origin', '*');
			res.header('Access-Control-Allow-Methods', 'GET,OPTIONS');
			res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With');
			res.send(200);
		});

		this.express.get( '^/press/bank/:page([0-9]{1,2})/:bank([0-9]{1,2})', this.processBankPress.bind(this));

		this.express.get( '^/press/bank/:page([0-9]{1,2})/:bank([0-9]{1,2})/:direction(down|up)', this.processBankTrigger.bind(this));

		this.express.get('^/style/bank/:page([0-9]{1,2})/:bank([0-9]{1,2})', this.processBankStyle.bind(this));

		this.express.use((req, res) => {
			debug('404', req.url);
			res.status(404);
			res.sendFile(path.resolve(__dirname + '/../public/404.html'));
		});
	}

	listenForHttp() {

		if (this !== undefined && this.close !== undefined) {
			this.close();
		}

		try {
			this.on('error', (e) => {
				if (e.code == 'EADDRNOTAVAIL') {
					debug("EADDRNOTAVAIL: " + this.config.bind_ip )
					this.system.emit('skeleton-ip-unavail');
					this.system.emit('skeleton-info', 'appURL', this.config.bind_ip + ' unavailable. Select another IP');
					this.system.emit('skeleton-info', 'appStatus', 'Error');
				}
				else {
					debug(e);
				}
			}).listen(this.config.http_port, this.config.bind_ip, () => {
				debug('new url:', 'http://' + this.address().address + ':' + this.address().port + '/' )
				this.system.emit('skeleton-info', 'appStatus', 'Running');
				this.system.emit('skeleton-info', 'appURL', 'http://' + this.address().address + ':' + this.address().port + '/');
			});
		}
		catch(e) {
			debug("http bind error", e);
		}
	}

	log() {
		var args = Array.prototype.slice.call(arguments);
		args.unshift('log', 'http');
		debug(args);
	}

	processBankPress(req, res) {
		res.header('Access-Control-Allow-Origin', '*');
		res.header('Access-Control-Allow-Methods', 'GET,OPTIONS');
		res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With');

		debug("Got HTTP /press/bank/ (trigger) page ",req.params.page,"button",req.params.bank);
		this.system.emit('bank_pressed', req.params.page, req.params.bank, true);

		setTimeout(() => {
			debug("Auto releasing HTTP /press/bank/ page ",req.params.page,"button",req.params.bank);
			this.system.emit('bank_pressed', req.params.page, req.params.bank, false);
		}, 20);

		res.send( 'ok' );
	}

	processBankStyle(req, res) {
		res.header('Access-Control-Allow-Origin', '*');
		res.header('Access-Control-Allow-Methods', 'GET,OPTIONS');
		res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With');

		debug('Got HTTP /style/bank ', req.params.page, 'button', req.params.bank);

		let responseStatus = 'ok';

		function rgb(r, g, b) {
			r = parseInt(r, 16);
			g = parseInt(g, 16);
			b = parseInt(b, 16);

			if (isNaN(r) || isNaN(g) || isNaN(b)) return false;
			return ((r & 0xff) << 16) | ((g & 0xff) << 8) | (b & 0xff);
		}

		function rgbRev(dec) { 
			return  {
				r: (dec & 0xff0000) >> 16,
				g: (dec & 0x00ff00) >> 8,
				b: (dec & 0x0000ff)
			};
		};

		function validateAlign(data) {
			data = data.toLowerCase().split(':');
			const hValues = ['left', 'center', 'right'];
			const vValues = ['top', 'center', 'bottom'];
			return hValues.includes(data[0]) && vValues.includes(data[1]);
		}

		if (req.query.bgcolor) {
			const value = req.query.bgcolor.replace(/#/, '');
			const color = rgb(value.substr(0, 2), value.substr(2, 2), value.substr(4, 2));
			if (color !== false) {
				this.system.emit('bank_set_key', req.params.page, req.params.bank, 'bgcolor', color);
			}
		}

		if (req.query.color) {
			const value = req.query.color.replace(/#/, '');
			const color = rgb(value.substr(0, 2), value.substr(2, 2), value.substr(4, 2));
			if (color !== false) {
				this.system.emit('bank_set_key', req.params.page, req.params.bank, 'color', color);
			}
		}

		if (req.query.size) {
			const value = req.query.size.replace(/pt/i, '');
			this.system.emit('bank_set_key', req.params.page, req.params.bank, 'size', value);
		}

		if (req.query.text || req.query.text === '') {
			this.system.emit('bank_set_key', req.params.page, req.params.bank, 'text', req.query.text);
		}

		if (req.query.png64 || req.query.png64 === '') {
			if (req.query.png64 === '') {
				this.system.emit('bank_set_key', req.params.page, req.params.bank, 'png64', undefined);
			}
			else if (!req.query.png64.match(/data:.*?image\/png/)) {
				responseStatus = 'png64 must be a base64 encoded png file';
			}
			else {
				const data = req.query.png64.replace(/^.*base64,/, '');
				this.system.emit('bank_set_key', req.params.page, req.params.bank, 'png64', data);
			}
		}

		if (req.query.alignment && validateAlign(req.query.alignment)) {
			this.system.emit('bank_set_key', req.params.page, req.params.bank, 'alignment', req.query.alignment.toLowerCase());
		}

		if (req.query.pngalignment && validateAlign(req.query.pngalignment)) {
			this.system.emit('bank_set_key', req.params.page, req.params.bank, 'pngalignment', req.query.pngalignment.toLowerCase());
		}

		this.system.emit('graphics_bank_invalidate', req.params.page, req.params.bank);

		res.send(responseStatus);
	}

	processBankTrigger(req, res) {
		res.header('Access-Control-Allow-Origin', '*');
		res.header('Access-Control-Allow-Methods', 'GET,OPTIONS');
		res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With');

		if (req.params.direction == 'down') {
			debug("Got HTTP /press/bank/ (DOWN) page ",req.params.page,"button",req.params.bank);
			this.system.emit('bank_pressed', req.params.page, req.params.bank, true);
		}
		else {
			debug("Got HTTP /press/bank/ (UP) page ",req.params.page,"button",req.params.bank);
			this.system.emit('bank_pressed', req.params.page, req.params.bank, false);
		}

		res.send( 'ok' );
	}
}


//exports = module.exports = http;

exports = module.exports = function (system) {
	return new server_http(system, new CompanionExpress());
};
