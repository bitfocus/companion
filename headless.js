#!/usr/bin/env node
var main = require('./app.js');
var fs = require("fs");
var path = require("path");
var system = main();
var os = require('os');

function packageinfo() {
	var self = this;
	var fileContents = fs.readFileSync(__dirname + '/package.json');
	var object = JSON.parse(fileContents);
	return object;
};

var build = fs.readFileSync(__dirname + "/BUILD").toString().trim();
var pkg = packageinfo();

if (process.argv.length < 4) {
	console.log("Usage: ./headless.js <ip> <port>");
	console.log("");
	console.log("Example: ./headless.js 127.0.0.1 8000");
	process.exit(1);
}

system.emit('skeleton-info', 'appVersion', pkg.version );
system.emit('skeleton-info', 'appBuild', build.trim() );
system.emit('skeleton-info', 'appName', pkg.description);
system.emit('skeleton-info', 'configDir', process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME'] );

setTimeout(function () {
	system.emit('skeleton-bind-ip', process.argv[2]);
	system.emit('skeleton-bind-port', process.argv[3]);

	system.emit('skeleton-ready');
}, 1000);
