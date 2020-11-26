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

var debug   = require('debug')('lib/update');
var fs      = require('fs');
var os      = require('os');
var http    = require("https"); // https
var shortid = require('shortid');

class update {

	constructor(system, cfgdir) {
		debug('loading update');

		this.package = {};
		this.system = system;
		this.cfgdir = cfgdir;
		this.serverdata = {};

		var x = new Date();
		var offset = -x.getTimezoneOffset();
		var off = (offset>=0?"+":"-")+parseInt(offset/60);
		var build = fs.readFileSync(__dirname + '/../BUILD').toString();

		this.system.on('update_data', (cb) => {
			cb(this.serverdata);
		});

		this.system.on('update_get', (cb) => {
			cb(this);
		});

		this.system.emit('io_get', (io) => {
			this.system.on('io_connect', (client) => {
				debug('updating data');
				client.on('update_data', () => {
					client.emit('update_data', this.serverdata);
				});
			});

			this.system.on('update', (data) => {
				debug('fresh data received', data);
				io.emit('update_data', data);
			});
		});

		// Information about the computer asking for a update. This way
		// we can filter out certain kinds of OS/versions if there
		// is known bugs etc.
		this.payload = {
			app_name: 'companion',
			app_build: build,
			arch: os.arch(),
			tz: off,
			cpus: os.cpus(),
			platform: os.platform(),
			release: os.release(),
			type: os.type(),
			id: this.uuid()
		};

		fs.readFile(__dirname + '/../package.json', 'utf8', (err, data) => {
			if (err) {
				throw err;
			}

			this.package = JSON.parse(data);
			this.payload.app_version = this.package.version;
			this.requestUpdate(this.payload);
			this.system.emit('version-local', this.package.version);
		});
	}

	requestUpdate(payload) {
		var options = {
			hostname: 'updates.bitfocus.io',
			path: '/updates',
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			}
		};

		var req = http.request(options, (res) => {

			if (res.statusCode == 200) {
				res.setEncoding('utf8');

				res.on('data', (body) => {
					try {
						var rp = JSON.parse( body );
						debug("update server says", rp);
						this.serverdata = rp;
						this.system.emit('update', this.serverdata);
					}
					catch(e) {
						debug('update server said something unexpected!', body, e);
					}
				});
			} else {
				debug('update server said status',res.statusCode);
			}

		});
		req.on('error', (e) => {
			console.log('problem with request: ' + e.message);
		});

		// write data to request body
		req.write(JSON.stringify( payload ));
		req.end();
	}

	// Unique identifier for this user
	uuid() {
		var uuid = shortid.generate();

		if (fs.existsSync(this.cfgdir + 'machid')) {
			var text = "";
			try {
				text = fs.readFileSync(this.cfgdir + 'machid');

				if (text) {
					uuid = text.toString();
					debug('read uuid', uuid);
				}
			}
			catch(e) {
				debug('error reading uuid-file', e);
			}
		}
		else {
			debug('creating uuid file');
			fs.writeFileSync(this.cfgdir + 'machid', uuid);
		}

		return uuid;
	}
}

exports = module.exports = function (system,cfgdir) {
	return new update(system,cfgdir);
};
