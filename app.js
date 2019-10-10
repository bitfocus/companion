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


if (process.env.DEVELOPER !== undefined) {
	process.env['DEBUG'] = '*,-websocket*,-express*,-engine*,-socket.io*,-send*,-db,-NRC*,-follow-redirects,-electron-timer-fix';
}

// Fix timers in electron
require('./electron-timer-fix').fix();

global.MAX_BUTTONS = 32;
global.MAX_BUTTONS_PER_ROW = 8;

const EventEmitter = require('events');
let system = new EventEmitter();
const fs = require("fs");
const path = require('path')
const debug = require('debug')('app');
const mkdirp = require('mkdirp');
const util = require('util');
const events = require('events');
const stripAnsi = require('strip-ansi');
let logbuffer = [];
let logwriting = false;
let skeleton_info = {};

let config;
let cfgDir;

system.on('skeleton-info', (key, val) => {
	skeleton_info[key] = val;
	if (key == 'configDir') {
		debug('configuration directory', val);
		cfgDir = val + "/companion/";
		mkdirp(cfgDir, err => {
			debug("mkdirp",cfgDir,err);
			config = new (require('./bitfocus-libs/config'))(system, cfgDir, {
				http_port: 8888,
				bind_ip: "127.0.0.1",
				start_minimised: false,
			});
		});
	}
});

system.on('configdir_get', cb => cb(cfgDir));

system.on('skeleton-info-info', cb => cb(skeleton_info));

system.on('config_loaded', config => {
	system.emit('skeleton-info', 'appURL', 'Waiting for webserver..');
	system.emit('skeleton-info', 'appStatus', 'Starting');
	system.emit('skeleton-info', 'bindInterface', config.bind_ip);
	system.emit('skeleton-info', 'startMinimised', config.start_minimised);
});

system.on('exit', () => {
	console.log("somewhere, the system wants to exit. kthxbai");

	system.emit('instance_getall', (instances, active) => {
		try {
			for (var key in active) {
				if (instances[key].label !== 'internal') {
					try {
						active[key].destroy();
					} catch(e) {
						console.log("Could not destroy",instances[key].label);
					}
				}
			}
		} catch(e) {
			console.log("Could not destroy all instances");
		}
	});

	setImmediate(() => process.exit());
});


system.on('skeleton-bind-ip', ip => {
	config.bind_ip = ip;
	system.emit('config_set', 'bind_ip', ip);
	system.emit('ip_rebind');
});

system.on('skeleton-bind-port', port => {
	let p = parseInt(port);
	if (p >= 1024 && p <= 65535) {
		config.http_port = p;
		system.emit('config_set', 'http_port', p);
		system.emit('ip_rebind');
	}
});

system.on('skeleton-start-minimised', minimised => {
	config.start_minimised = minimised;
	system.emit('config_set', 'start_minimised', minimised);
});

system.on('skeleton-ready', () => {

	if (system.headless === true) {
		debug("Going into headless mode. Logs will be written to companion.log")

		setInterval(() => {

			if (logbuffer.length > 0 && logwriting == false) {
				let writestring = logbuffer.join("\n");
				logbuffer = [];
				logwriting = true;
				fs.appendFile('./companion.log', writestring + "\n", err => {
					if (err) {
						console.log("log write error", err);
					}
					logwriting = false;
				});
			}
		}, 1000)

		process.stderr.write = () => {
			let arr = [];
			for (let n in arguments) {
				arr.push(arguments[0]);
			}
			let line = new Date().toISOString() + " " + stripAnsi(arr.join(" ").trim() );
			logbuffer.push(line);
		};


	}

	const server_http= require('./lib/server_http')(system);
	const io         = require('./lib/io')(system, server_http);
	const log        = require('./lib/log')(system,io);
	const db         = require('./lib/db')(system,cfgDir);
	const userconfig = require('./lib/userconfig')(system)
	const update     = require('./lib/update')(system,cfgDir);
	const page       = require('./lib/page')(system)
	const appRoot    = require('app-root-path');
	const variable   = require('./lib/variable')(system);
	const feedback   = require('./lib/feedback')(system);
	const action     = require('./lib/action')(system);
	const bank       = require('./lib/bank')(system);
	const elgatoDM   = require('./lib/elgato_dm')(system);
	const preview    = require('./lib/preview')(system);
	const instance   = require('./lib/instance')(system);
	const osc        = require('./lib/osc')(system);
	const server_api = require('./lib/server_api')(system);
	const server_tcp = require('./lib/server_tcp')(system);
	const server_udp = require('./lib/server_udp')(system);
	const artnet     = require('./lib/artnet')(system);
	const rest       = require('./lib/rest')(system);
	const rest_poll  = require('./lib/rest_poll')(system);
	const loadsave   = require('./lib/loadsave')(system);
	const preset     = require('./lib/preset')(system);
	const tablet     = require('./lib/tablet')(system);
	const satellite  = require('./lib/satellite_server')(system);
	const ws_api     = require('./lib/ws_api')(system);

	system.emit('modules_loaded');

	system.on('exit', () => {
		elgatoDM.quit();
	});

});

system.on('skeleton-single-instance-only', response => {
	response(true);
});

exports = module.exports = headless => {
	if (headless !== undefined && headless === true) {
		system.headless = true;
	}
	return system;
}
