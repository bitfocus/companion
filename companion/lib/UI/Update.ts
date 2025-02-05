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

import LogController from '../Log/Controller.js'
import type { AppInfo } from '../Registry.js'
import type { AppUpdateInfo } from '@companion-app/shared/Model/Common.js'
import { compileUpdatePayload } from './UpdatePayload.js'
import { publicProcedure, router, toIterable } from './TRPC.js'
import { EventEmitter } from 'events'

interface UpdateEvents {
	info: [info: AppUpdateInfo]
}

export class UIUpdate {
	readonly #logger = LogController.createLogger('UI/Update')

	readonly #appInfo: AppInfo

	readonly #updateEvents = new EventEmitter<UpdateEvents>()

	/**
	 * Latest update information
	 */
	#latestUpdateData: AppUpdateInfo | null = null

	constructor(appInfo: AppInfo) {
		this.#logger.silly('loading update')
		this.#appInfo = appInfo
	}

	startCycle() {
		// Make a request now
		this.#requestUpdate()
		setInterval(
			() => {
				// Do a check every day, in case this installation is being left on constantly
				this.#requestUpdate()
			},
			24 * 60 * 60 * 1000
		)
	}

	/**
	 * Perform the update request
	 */
	#requestUpdate(): void {
		fetch('https://updates.bitfocus.io/updates', {
			method: 'POST',
			body: JSON.stringify(compileUpdatePayload(this.#appInfo)),
			headers: {
				'Content-Type': 'application/json',
			},
		})
			.then(async (response) => response.json())
			.then((body) => {
				this.#logger.debug(`fresh update data received ${JSON.stringify(body)}`)
				this.#latestUpdateData = body as AppUpdateInfo

				this.#updateEvents.emit('info', this.#latestUpdateData)
			})
			.catch((e) => {
				this.#logger.verbose('update server said something unexpected!', e)
			})
	}

	createTrpcRouter() {
		const self = this
		return router({
			version: publicProcedure.query(() => {
				return {
					appVersion: this.#appInfo.appVersion,
					appBuild: this.#appInfo.appBuild,
				}
			}),

			updateInfo: publicProcedure.subscription(async function* (opts) {
				const changes = toIterable(self.#updateEvents, 'info', opts.signal)

				if (self.#latestUpdateData) yield self.#latestUpdateData

				for await (const [data] of changes) {
					yield data
				}
			}),
		})
	}
}
