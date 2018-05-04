var EventEmitter = require('events');
var system = new EventEmitter();
var fs = require("fs");
var path = require('path')

var config = new (require('./bitfocus-libs/config'))(system, {
	http_port: 8000,
	bind_ip: "127.0.0.1",
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

system.on('skeleton-ready', function() {

	var http = require('./lib/http')(system, 80);
	var io   = require('./lib/io')(system, http);
	var panel = new (require('./lib/elgato'))(system);
	var modul = {};
	var active_module = 'base';
	var appRoot = require('app-root-path');
	var express = require('express');

	modul['base'] = new (require('./modules/base.js'))(system, panel);
	modul['timer'] = new (require('./modules/timer.js'))(system, panel);

	system.on('exit', function() {
		panel.quit();
	});

	console.log("waiting for loading items");
	panel.on('ready', function() {

		modul.base.activate(panel);

		system.on('active_module', function(module) {

			for (var x = 0; x < 15; x++) {
				panel.buttonState[x].design = undefined;
				panel.buttonClear(x);
			}

			// deactivate previous module
			if (active_module != module && active_module !== undefined) {
				modul[active_module].deactivate();
			}

			active_module = module;

			for (var mod in modul) {
				modul[mod].active_module = active_module;
			}

			modul[module].activate();

			for (var idx in panel.buttonState) {
				panel.buttonState[idx].needsUpdate = true;
			}
		});

		// handle keys
		panel.setButtonHandler(function(key,state) {
			if (key == 10 && state == true && active_module != 'base') {
				system.emit('active_module', 'base');
			}
			if (modul[active_module].buttonHandler !== undefined) {
				modul[active_module].buttonHandler(key,state);
			}
		});

		panel.begin();

	});


});

exports = module.exports = function() {
	return system;
}
