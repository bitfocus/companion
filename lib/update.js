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

var debug = require('debug')('lib/update')
var fs = require('fs')
var os = require('os')
var http = require('https') // https
var shortid = require('shortid')

function update(system, cfgdir) {
	var self = this
	debug('loading update')
	self.package = {}
	self.system = system
	self.cfgdir = cfgdir
	self.serverdata = {}

	var x = new Date()
	var offset = -x.getTimezoneOffset()
	var off = (offset >= 0 ? '+' : '-') + parseInt(offset / 60)
	var build = fs.readFileSync(__dirname + '/../BUILD').toString()

	self.system.on('update_data', function (cb) {
		cb(self.serverdata)
	})

	self.system.on('update_get', function (cb) {
		cb(self)
	})

	self.system.emit('io_get', function (io) {
		system.on('io_connect', function (socket) {
			debug('updating data')
			socket.on('update_data', function () {
				socket.emit('update_data', self.serverdata)
			})
		})

		self.system.on('update', function (data) {
			debug('fresh data received', data)
			io.emit('update_data', data)
		})
	})

	// Information about the computer asking for a update. This way
	// we can filter out certain kinds of OS/versions if there
	// is known bugs etc.
	self.payload = {
		app_name: 'companion',
		app_build: build,
		arch: os.arch(),
		tz: off,
		cpus: os.cpus(),
		platform: os.platform(),
		release: os.release(),
		type: os.type(),
		id: self.uuid(),
	}

	fs.readFile(__dirname + '/../package.json', 'utf8', function (err, data) {
		if (err) throw err
		self.package = JSON.parse(data)
		self.payload.app_version = self.package.version
		self.requestUpdate(self.payload)
		system.emit('version-local', self.package.version)
	})

	return self
}

update.prototype.requestUpdate = function (payload) {
	var self = this

	var options = {
		hostname: 'updates.bitfocus.io',
		path: '/updates',
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
	}

	var req = http.request(options, function (res) {
		if (res.statusCode == 200) {
			res.setEncoding('utf8')

			res.on('data', function (body) {
				try {
					var rp = JSON.parse(body)
					debug('update server says', rp)
					self.serverdata = rp
					self.system.emit('update', self.serverdata)
				} catch (e) {
					debug('update server said something unexpected!', body, e)
				}
			})
		} else {
			debug('update server said status', res.statusCode)
		}
	})
	req.on('error', function (e) {
		console.log('problem with request: ' + e.message)
	})
	// write data to request body
	req.write(JSON.stringify(payload))
	req.end()
}

// Unique identifier for this user
update.prototype.uuid = function () {
	var self = this
	var uuid = shortid.generate()

	if (fs.existsSync(self.cfgdir + 'machid')) {
		var text = ''
		try {
			text = fs.readFileSync(self.cfgdir + 'machid')
			if (text) {
				uuid = text.toString()
				debug('read uuid', uuid)
			}
		} catch (e) {
			debug('error reading uuid-file', e)
		}
	} else {
		debug('creating uuid file')
		fs.writeFileSync(self.cfgdir + 'machid', uuid)
	}

	return uuid
}

exports = module.exports = function (system, cfgdir) {
	return new update(system, cfgdir)
}
