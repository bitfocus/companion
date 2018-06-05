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
					bind_ip: "127.0.0.1"
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
	config.http_port = port;
	system.emit('config_set', 'http_port', port);
	system.emit('ip_rebind');
});

system.on('skeleton-ready', function() {

	var http     = require('./lib/http')(system);
	var io       = require('./lib/io')(system, http);
	var log      = require('./lib/log')(system,io);
	var db       = require('./lib/db')(system,cfgDir);
	var appRoot  = require('app-root-path');
	var express  = require('express');
	var bank     = require('./lib/bank')(system);
	var elgatoDM = require('./lib/elgato_dm')(system);
	var preview  = require('./lib/preview')(system);
	var action   = require('./lib/action')(system);
	var instance = require('./lib/instance')(system);
	var variable = require('./lib/variable')(system);
	var osc      = require('./lib/osc')(system);
	var rest     = require('./lib/rest')(system);
	var udp      = require('./lib/udp')(system);

	system.on('exit', function() {
		elgatoDM.quit();
	});

});

exports = module.exports = function() {
	return system;
}
