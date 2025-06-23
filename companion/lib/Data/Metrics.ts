/*
 * This file is part of the Companion project
 * Copyright (c) 2018 Bitfocus AS
 * Authors: William Viker <william@bitfocus.io>, Håkon Nessjøen <haakon@bitfocus.io>
 *
 * This program is free software.
 * You should have received a copy of the MIT licence as well as the Bitfocus
 * Individual Contributor License Agreement for companion along with
 * this program.
 */

import crypto from 'crypto'
import LogController from '../Log/Controller.js'
import type { SurfaceController } from '../Surface/Controller.js'
import type { InstanceController } from '../Instance/Controller.js'
import type { AppInfo } from '../Registry.js'

export class DataMetrics {
	readonly #logger = LogController.createLogger('Data/Metrics')

	readonly #appInfo: AppInfo
	readonly #surfacesController: SurfaceController
	readonly #instancesController: InstanceController

	constructor(appInfo: AppInfo, surfacesController: SurfaceController, instancesController: InstanceController) {
		this.#appInfo = appInfo
		this.#surfacesController = surfacesController
		this.#instancesController = instancesController
	}

	/**
	 * Run reporting cycle
	 */
	#cycle() {
		this.#logger.silly('cycle')

		const relevantSurfaceHashes: string[] = []
		const relevantSurfaces: Record<
			string,
			{
				type: string | undefined
				description: string | undefined
			}
		> = {}

		try {
			const surfaceGroups = this.#surfacesController.getDevicesList()
			for (const surfaceGroup of surfaceGroups) {
				if (!surfaceGroup.surfaces) continue

				for (const surface of surfaceGroup.surfaces) {
					if (surface.id && surface.isConnected && !surface.id.startsWith('emulator:')) {
						// remove leading "satellite-" from satellite device serial numbers.
						const serialNumber = surface.id.replace('satellite-', '')

						// Collect info about the type of the surface
						relevantSurfaces[serialNumber] = {
							type: surface.integrationType,
							description: surface.type,
						}

						// normalize serialnumber by md5 hashing it
						const deviceHash = crypto.createHash('md5').update(serialNumber).digest('hex')
						if (deviceHash && deviceHash.length === 32) relevantSurfaceHashes.push(deviceHash)
					}
				}
			}
		} catch (_e) {
			// don't care
		}

		const moduleVersionCounts = this.#instancesController.getConnectionsMetrics()

		try {
			const moduleCountsOld: Record<string, number> = {}
			for (const [key, value] of Object.entries(moduleVersionCounts)) {
				if (!value) continue

				let sum = 0
				for (const count of Object.values(value)) {
					sum += count || 0
				}

				moduleCountsOld[key] = sum
			}

			const payload = {
				i: this.#appInfo.machineId,
				r: process.uptime(),
				m: moduleCountsOld,
				mv: moduleVersionCounts,
				d: relevantSurfaceHashes,
				s: relevantSurfaces,
			}

			// push metrics back home - if we can!
			this.#pushMetrics(payload)
		} catch (_e) {
			// don't care
		}
	}

	/**
	 * Submit metrics
	 */
	#pushMetrics(payload: Record<string, any>): void {
		fetch('https://updates.bitfocus.io/companion/metrics', {
			method: 'POST',
			body: JSON.stringify(payload),
			headers: {
				'Content-Type': 'application/json',
			},
		}).catch(() => {
			// don't care.
		})
	}

	/**
	 * Start the reporting cycle
	 */
	startCycle(): void {
		// don't bother with pushing metrics in the startup phase, let's give the system a chance to start up
		setTimeout(() => this.#cycle(), 1000 * 120)

		// after this, we'll push metrics every 60 minutes
		setInterval(() => this.#cycle(), 1000 * 60 * 60)
	}
}
