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
import type { paths as CompanionUpdatesApiPaths } from '@companion-app/shared/OpenApi/CompanionUpdates.js'
import createClient, { type Client } from 'openapi-fetch'

type UpdateEvents = {
	info: [info: AppUpdateInfo]
}

const baseUrl = 'https://updates.companion.free'

export class UIUpdate {
	readonly #logger = LogController.createLogger('UI/Update')

	readonly #appInfo: AppInfo
	readonly #openApiClient: Client<CompanionUpdatesApiPaths>

	readonly #updateEvents = new EventEmitter<UpdateEvents>()

	/**
	 * Latest update information
	 */
	#latestUpdateData: AppUpdateInfo | null = null

	constructor(appInfo: AppInfo) {
		this.#logger.silly('loading update')
		this.#appInfo = appInfo

		this.#openApiClient = createClient<CompanionUpdatesApiPaths>({
			baseUrl,
			headers: {
				'User-Agent': `Companion ${appInfo.appVersion}`,
			},
		})
	}

	startCycle(): void {
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
		this.#openApiClient
			.POST('/updates', {
				body: compileUpdatePayload(this.#appInfo),
			})
			.then((res) => {
				if (res.error) {
					this.#logger.warn(`update server said something unexpected!: ${res.error.message}`)
				} else {
					this.#logger.debug(`fresh update data received ${JSON.stringify(res.data)}`)
					this.#latestUpdateData = res.data as AppUpdateInfo

					this.#updateEvents.emit('info', this.#latestUpdateData)
				}
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
