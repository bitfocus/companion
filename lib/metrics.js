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

var debug = require('debug')('lib/metrics')
var crypto = require('crypto')
var http = require('https') // https

function metrics(system) {
	var self = this
	self.system = system
	self.update = null
	debug('init')

	self.system.on('modules_loaded', function (cb) {
		self.system.emit('update_get', function (update) {
			self.update = update
		})

		// don't bother with pushing metrics in the startup phase, let's give the system a chance to start up
		setTimeout(() => self.cycle(), 1000 * 120)

		// after this, we'll push metrics every 60 minutes
		setInterval(() => self.cycle(), 1000 * 60 * 60)
	})
}

metrics.prototype.cycle = function () {
	var self = this
	debug('cycle')

	self.system.emit('devices_list_get', function (devices) {
		let relevantDevices = []

		try {
			Object.values(devices).forEach((device) => {
				if (device.serialnumber !== undefined && device.serialnumber !== 'emulator') {
					// remove leading "satellite-" from satellite device serial numbers.
					const serialNumber = device.serialnumber.replace('satellite-', '')
					// normalize serialnumber by md5 hashing it, we don't want/need the specific serialnumber anyways.
					const deviceHash = crypto.createHash('md5').update(serialNumber).digest('hex')
					if (deviceHash && deviceHash.length === 32) relevantDevices.push(deviceHash)
				}
			})
		} catch (e) {
			// don't care
		}

		self.system.emit('instance_getall', function (instances) {
			try {
				const instanceCount = {}

				Object.keys(instances).forEach((instance) => {
					if (instances[instance].instance_type !== 'bitfocus-companion' && instances[instance].enabled !== false) {
						if (instanceCount[instances[instance].instance_type]) {
							instanceCount[instances[instance].instance_type]++
						} else {
							instanceCount[instances[instance].instance_type] = 1
						}
					}
				})

				const payload = {
					i: self.update.uuid(),
					r: parseInt(process.uptime()),
					m: instanceCount,
					d: relevantDevices,
				}

				// push metrics back home - if we can!
				self.pushMetrics(payload)
			} catch (e) {
				// don't care
			}
		})
	})
}

metrics.prototype.pushMetrics = function (payload) {
	const self = this

	const options = {
		hostname: 'updates.bitfocus.io',
		path: '/companion/metrics',
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
	}

	const req = http.request(options, function (res) {
		// don't care.
	})

	req.on('error', function (e) {
		// don't care.
	})

	// write payload
	req.write(JSON.stringify(payload))
	req.end()
}

module.exports = function (system) {
	return new metrics(system)
}
