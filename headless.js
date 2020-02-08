#!/usr/bin/env node
var main = require('./app.js');
var fs = require("fs");
var path = require("path");
var system = main(process.env.DEVELOPER ? false : true);
var os = require('os');

console.log("Starting");

function packageinfo() {
	var self = this;
	var fileContents = fs.readFileSync(__dirname + '/package.json');
	var object = JSON.parse(fileContents);
	return object;
};

var build = fs.readFileSync(__dirname + "/BUILD").toString().trim();
var pkg = packageinfo();

var ifaces = os.networkInterfaces();

if (process.argv.length > 2 && process.argv[2].substr(0,1) == '-') {

		console.error("Usage: ./headless.js [device] [port]");
		console.error("");
		console.error("Available Interfaces:");

		Object.keys(ifaces).forEach(function (ifname) {
				ifaces[ifname].forEach(function (iface) {
						if ('IPv4' !== iface.family) {
								// skip over non-ipv4 addresses for now
								return;
						}
						console.error(ifname, iface.address);
				});
		});

		console.error("");
		console.error("Example: ./headless.js eth0");
		process.exit(1);

} else if (process.argv.length < 3) {
	Object.keys(ifaces).forEach(function (ifname) {
		ifaces[ifname].find(function (iface) {
				if ('IPv4' === iface.family && iface.internal) {
						process.argv.push(ifname);
						console.error('Starting headless with interface "' + ifname + '"');
						return true;
				}
				return false;
		});
	});
}

system.emit('skeleton-info', 'appVersion', pkg.version );
system.emit('skeleton-info', 'appBuild', build.trim() );
system.emit('skeleton-info', 'appName', pkg.description);
system.emit('skeleton-info', 'configDir', process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME'] );

if (process.env.COMPANION_CONFIG_BASEDIR !== undefined) {
	system.emit('skeleton-info', 'configDir', process.env.COMPANION_CONFIG_BASEDIR);
}
else {
	system.emit('skeleton-info', 'configDir', process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME'] );
}

var port = '8000';

if (process.argv[3] != null) {
		port = process.argv[3];
}

if (process.argv[2] in ifaces) {
		var address;
		var iface = ifaces[process.argv[2]];

		iface.forEach(function (ipv) {
						if ('IPv4' !== ipv.family) {
								// skip over non-ipv4 addresses for now
								return;
						}
						address = ipv.address;
		});

		setTimeout(function () {
				system.emit('skeleton-bind-ip', address);
				system.emit('skeleton-bind-port', port);
				system.emit('skeleton-ready');
				console.log("Started");
		}, 1000);
}
else {
		console.log("Interface not found!");
		process.exit(1);
}
