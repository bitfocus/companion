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

import crypto from 'crypto'
import CoreBase from '../Core/Base.js'
import got from 'got'

class DataMetrics extends CoreBase {
	/**
	 * @param {import('../Registry.js').default} registry - the application core
	 */
	constructor(registry) {
		super(registry, 'metrics', 'Data/Metrics')
	}

	/**
	 * Run reporting cycle
	 */
	#cycle() {
		this.logger.silly('cycle')

		/**
		 * @type {string[]}
		 */
		const relevantDevices = []

		try {
			const surfaceGroups = this.surfaces.getDevicesList()
			for (const surfaceGroup of surfaceGroups) {
				if (!surfaceGroup.surfaces) continue

				for (const surface of surfaceGroup.surfaces) {
					if (surface.id && surface.isConnected && !surface.id.startsWith('emulator:')) {
						// remove leading "satellite-" from satellite device serial numbers.
						const serialNumber = surface.id.replace('satellite-', '')
						// normalize serialnumber by md5 hashing it, we don't want/need the specific serialnumber anyways.
						const deviceHash = crypto.createHash('md5').update(serialNumber).digest('hex')
						if (deviceHash && deviceHash.length === 32) relevantDevices.push(deviceHash)
					}
				}
			}
		} catch (e) {
			// don't care
		}

		const instanceCount = this.instance.getInstancesMetrics()

		try {
			const payload = {
				i: this.registry.appInfo.machineId,
				r: process.uptime(),
				m: instanceCount,
				d: relevantDevices,
			}

			// push metrics back home - if we can!
			this.#pushMetrics(payload)
		} catch (e) {
			// don't care
		}
	}

	/**
	 * Submit metrics
	 * @param {Record<string, any>} payload
	 */
	#pushMetrics(payload) {
		got
			.post('https://updates.bitfocus.io/companion/metrics', {
				json: payload,
				responseType: 'json',
			})
			.catch(() => {
				// don't care.
			})
	}

	/**
	 * Start the reporting cycle
	 */
	startCycle() {
		// don't bother with pushing metrics in the startup phase, let's give the system a chance to start up
		setTimeout(() => this.#cycle(), 1000 * 120)

		// after this, we'll push metrics every 60 minutes
		setInterval(() => this.#cycle(), 1000 * 60 * 60)
	}
}

export default DataMetrics
