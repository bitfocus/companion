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

process.env['DEBUG'] = '*,-express*,-engine*,-socket.io*,-send*,-db,-NRC*,-follow-redirects,-electron-timer-fix';

// Fix timers in electron
require('./electron-timer-fix').fix();


var EventEmitter = require('events');
var system = new EventEmitter();
var fs = require("fs");
var path = require('path')
var debug = require('debug')('app');
var mkdirp = require('mkdirp');
var skeleton_info = {};
var config;
var cfgDir;

system.on('skeleton-info', function(key, val) {
	skeleton_info[key] = val;
	if (key == 'configDir') {
		debug('configuration directory', val);
		cfgDir = val + "/companion/";
		mkdirp(cfgDir, function(err) {
			debug("mkdirp",cfgDir,err);
			config = new (require('./bitfocus-libs/config'))(system, cfgDir, {
				http_port: 8000,
				bind_ip: "127.0.0.1",
				start_minimised: false,
			});
		});
	}
});

system.on('configdir_get', function (cb) {
	cb(cfgDir);
});

system.on('skeleton-info-info', function(cb) {
	cb(skeleton_info);
});

system.on('config_loaded', function(config) {
	system.emit('skeleton-info', 'appURL', 'Waiting for webserver..');
	system.emit('skeleton-info', 'appStatus', 'Starting');
	system.emit('skeleton-info', 'bindInterface', config.bind_ip);
	system.emit('skeleton-info', 'startMinimised', config.start_minimised);
});

system.on('exit', function() {
	console.log("somewhere, the system wants to exit. kthxbai");
	setImmediate(function(){
		process.exit();
	});
});


system.on('skeleton-bind-ip', function(ip) {
	config.bind_ip = ip;
	system.emit('config_set', 'bind_ip', ip);
	system.emit('ip_rebind');
});

system.on('skeleton-bind-port', function(port) {
	var p = parseInt(port);
	if (p >= 1024 && p <= 65535) {
		config.http_port = p;
		system.emit('config_set', 'http_port', p);
		system.emit('ip_rebind');
	}
});

system.on('skeleton-start-minimised', function(minimised) {
	config.start_minimised = minimised;
	system.emit('config_set', 'start_minimised', minimised);
});

system.on('skeleton-ready', function() {

	var http       = require('./lib/http')(system);
	var io         = require('./lib/io')(system, http);
	var log        = require('./lib/log')(system,io);
	var db         = require('./lib/db')(system,cfgDir);
	var userconfig = require('./lib/userconfig')(system)
	var update     = require('./lib/update')(system,cfgDir);
	var page       = require('./lib/page')(system)
	var appRoot    = require('app-root-path');
	var variable   = require('./lib/variable')(system);
	var feedback   = require('./lib/feedback')(system);
	var bank       = require('./lib/bank')(system);
	var elgatoDM   = require('./lib/elgato_dm')(system);
	var preview    = require('./lib/preview')(system);
	var action     = require('./lib/action')(system);
	var instance   = require('./lib/instance')(system);
	var osc        = require('./lib/osc')(system);
	var rest       = require('./lib/rest')(system);
	var loadsave   = require('./lib/loadsave')(system);
	var preset     = require('./lib/preset')(system);
	var tablet     = require('./lib/tablet')(system);

	system.on('exit', function() {
		elgatoDM.quit();
	});

});

system.on('skeleton-single-instance-only', function (response) {
	response(true);
});

exports = module.exports = function() {
	return system;
}
