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

import { EventEmitter } from 'events'
import os from 'os'
import createClient, { type Client } from 'openapi-fetch'
import pRetry, { AbortError } from 'p-retry'
import z from 'zod'
import type { AppUpdateInfo } from '@companion-app/shared/Model/Common.js'
import type { paths as CompanionUpdatesApiPaths } from '@companion-app/shared/OpenApi/CompanionUpdates.js'
import LogController from '../Log/Controller.js'
import type { AppInfo } from '../Registry.js'
import { publicProcedure, router, toIterable } from './TRPC.js'
import { compileUpdatePayload } from './UpdatePayload.js'

type UpdateEvents = {
	info: [info: AppUpdateInfo]
}

const baseUrl = 'https://updates.companion.free'
const REQUEST_TIMEOUT_MS = 10_000

export class UIUpdate {
	readonly #logger = LogController.createLogger('UI/Update')

	readonly #appInfo: AppInfo
	readonly #openApiClient: Client<CompanionUpdatesApiPaths>

	readonly #updateEvents = new EventEmitter<UpdateEvents>()

	// no global retry timers anymore; retries are performed sequentially by #requestUpdate

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
		pRetry(
			async () => {
				const res = await this.#openApiClient.POST('/updates', {
					body: compileUpdatePayload(this.#appInfo),
					signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
				})

				if (res.error) {
					// Throwing an error here will trigger a retry
					throw new Error(res.error.message)
				}

				this.#logger.debug(`fresh update data received ${JSON.stringify(res.data)}`)
				if (!this.#appInfo.notifications) {
					this.#logger.debug(
						'Notification display has been disabled by the command-line: not showing the update message.'
					)
					return
				}

				this.#latestUpdateData = {
					link: res.data.link,
					message2: undefined,
					...res.data,
				}
				this.#updateEvents.emit('info', this.#latestUpdateData)
			},
			{
				retries: 2,
				minTimeout: 5 * 60 * 1000,
				maxRetryTime: REQUEST_TIMEOUT_MS * 2,
				onFailedAttempt: (error) => {
					if ((error instanceof Error && error.name === 'AbortError') || error instanceof AbortError) {
						this.#logger.verbose(`update request aborted after ${REQUEST_TIMEOUT_MS}ms`)
					} else {
						this.#logger.verbose('update server said something unexpected!', error)
					}
				},
			}
		).catch(() => {
			this.#logger.warn('All update request attempts failed')
		})
	}

	createTrpcRouter() {
		const self = this
		return router({
			version: publicProcedure
				.input(
					z
						.object({
							all: z.boolean(),
						})
						.optional()
				)
				.query(({ input }) => {
					let osName = os.type()
					if (/windows/i.test(osName)) {
						osName = os.version()
					}
					return {
						appVersion: this.#appInfo.appVersion,
						appBuild: this.#appInfo.appBuild,
						os: input?.all ? `${osName} (v${os.release()}; ${os.arch()})` : undefined,
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
