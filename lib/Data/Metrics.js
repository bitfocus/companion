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

const crypto = require('crypto')
const CoreBase = require('../Core/Base')
const Registry = require('../Registry')
const got = require('got')

class DataMetrics extends CoreBase {
	/**
	 *
	 * @param {Registry} registry
	 */
	constructor(registry) {
		super(registry, 'metrics', 'lib/Data/Metrics')

		this.debug('init')

		this.system.on('modules_loaded', (cb) => {
			// don't bother with pushing metrics in the startup phase, let's give the system a chance to start up
			setTimeout(() => this.cycle(), 1000 * 120)

			// after this, we'll push metrics every 60 minutes
			setInterval(() => this.cycle(), 1000 * 60 * 60)
		})
	}

	cycle() {
		this.debug('cycle')

		this.system.emit('devices_list_get', (devices) => {
			let relevantDevices = []

			try {
				devices.forEach((device) => {
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

			const instanceCount = this.instance.getInstancesMetrics()

			try {
				const payload = {
					i: this.system.machineId,
					r: parseInt(process.uptime()),
					m: instanceCount,
					d: relevantDevices,
				}

				// push metrics back home - if we can!
				this.pushMetrics(payload)
			} catch (e) {
				// don't care
			}
		})
	}

	pushMetrics(payload) {
		got
			.post('https://updates.bitfocus.io/companion/metrics', {
				json: payload,
				responseType: 'json',
			})
			.catch((e) => {
				// don't care.
			})
	}
}

module.exports = DataMetrics
