process.env['DEBUG'] = '*,-express*,-engine*,-socket.io*,-send*';

var EventEmitter = require('events');
var system = new EventEmitter();
var fs = require("fs");
var path = require('path')
var debug = require('debug')('app');

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
	var db = new (require('./lib/db'))(system);
	var appRoot = require('app-root-path');
	var express = require('express');
	var panel = new (require('./lib/elgato'))(system);
	var bank = new (require('./lib/bank'))(system);
	var button = new (require('./lib/button'))(system, panel);
	var action = new (require('./lib/action'))(system);
	var instance = new (require('./lib/instance'))(system);
	var variable = new (require('./lib/variable'))(system);

	system.on('exit', function() {
		panel.quit();
	});

});

exports = module.exports = function() {
	return system;
}
