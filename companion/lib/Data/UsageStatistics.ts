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
import type { SurfaceController } from '../Surface/Controller.js'
import type { InstanceController } from '../Instance/Controller.js'
import type { AppInfo } from '../Registry.js'
import type {
	paths as CompanionUpdatesApiPaths,
	operations as CompanionUpdatesApiOperations,
} from '@companion-app/shared/OpenApi/CompanionUpdates.js'
import createClient, { type Client } from 'openapi-fetch'
import pRetry, { AbortError } from 'p-retry'
import { compileUpdatePayload } from '../UI/UpdatePayload.js'
import * as Sentry from '@sentry/node'
import type { DataUserConfig } from './UserConfig.js'
import type { UserConfigGridSize, UserConfigModel } from '@companion-app/shared/Model/UserConfigModel.js'
import type { PageController } from '../Page/Controller.js'
import type { ControlsController } from '../Controls/Controller.js'
import type { CloudController } from '../Cloud/Controller.js'
import type { VariablesController } from '../Variables/Controller.js'
import type { ServiceController } from '../Service/Controller.js'
import { publicProcedure, router } from '../UI/TRPC.js'

type DetailedUsagePayload =
	CompanionUpdatesApiOperations['companion_detailed-usage_post']['requestBody']['content']['application/json']

const baseUrl = 'https://updates.companion.free'
const REQUEST_TIMEOUT_MS = 20_000

export class DataUsageStatistics {
	readonly #logger = LogController.createLogger('Data/UsageStatistics')

	readonly #appInfo: AppInfo
	readonly #surfacesController: SurfaceController
	readonly #instancesController: InstanceController
	readonly #pageController: PageController
	readonly #controlController: ControlsController
	readonly #variablesController: VariablesController
	readonly #cloudController: CloudController
	readonly #serviceController: ServiceController
	readonly #userConfigController: DataUserConfig

	readonly #openApiClient: Client<CompanionUpdatesApiPaths>

	#bindIp = ''

	constructor(
		appInfo: AppInfo,
		surfacesController: SurfaceController,
		instancesController: InstanceController,
		pageController: PageController,
		controlController: ControlsController,
		variablesController: VariablesController,
		cloudController: CloudController,
		serviceController: ServiceController,
		userConfigController: DataUserConfig
	) {
		this.#appInfo = appInfo
		this.#surfacesController = surfacesController
		this.#instancesController = instancesController
		this.#pageController = pageController
		this.#controlController = controlController
		this.#variablesController = variablesController
		this.#cloudController = cloudController
		this.#serviceController = serviceController
		this.#userConfigController = userConfigController

		this.#openApiClient = createClient<CompanionUpdatesApiPaths>({
			baseUrl,
			headers: {
				'User-Agent': `Companion ${appInfo.appVersion}`,
			},
		})
	}

	updateBindIp(bindIp: string): void {
		this.#bindIp = bindIp
	}

	/**
	 * Build the current usage payload
	 */
	#buildPayload(): DetailedUsagePayload {
		const rawGridSize: UserConfigGridSize = this.#userConfigController.getKey('gridSize')

		const payload: DetailedUsagePayload = {
			...compileUpdatePayload(this.#appInfo),
			uptime: process.uptime(),

			surfaces: [],
			connections: [],

			features: {
				isBoundToLoopback: this.#bindIp === '127.0.0.1' || this.#bindIp === '::1',
				hasAdminPassword: !!this.#userConfigController.getKey('admin_lockout'),
				hasPincodeLockout: !!this.#userConfigController.getKey('pin_enable'),
				cloudEnabled: !!this.#cloudController.data.cloudActive,
				httpsEnabled: !!this.#userConfigController.getKey('https_enabled'),

				tcpEnabled: !!this.#userConfigController.getKey('tcp_enabled'),
				tcpDeprecatedEnabled: !!this.#userConfigController.getKey('tcp_legacy_api_enabled'),
				udpEnabled: !!this.#userConfigController.getKey('udp_enabled'),
				udpDeprecatedEnabled: !!this.#userConfigController.getKey('udp_legacy_api_enabled'),
				oscEnabled: !!this.#userConfigController.getKey('osc_enabled'),
				oscDeprecatedEnabled: !!this.#userConfigController.getKey('osc_legacy_api_enabled'),
				rossTalkEnabled: !!this.#userConfigController.getKey('rosstalk_enabled'),
				emberPlusEnabled: !!this.#userConfigController.getKey('emberplus_enabled'),
				artnetEnabled: !!this.#userConfigController.getKey('artnet_enabled'),

				connectionCount: this.#instancesController.getAllConnectionIds().length,
				pageCount: this.#pageController.store.getPageCount(),
				buttonCount: this.#controlController.getAllButtons().length,
				triggerCount: this.#controlController.getAllTriggers().length,
				surfaceGroupCount: this.#surfacesController.getGroupCount(),
				customVariableCount: Object.keys(this.#variablesController.custom.getDefinitions()).length,
				expressionVariableCount: this.#controlController.getAllExpressionVariables().length,
				gridSize: {
					minCol: rawGridSize.minColumn,
					maxCol: rawGridSize.maxColumn,
					minRow: rawGridSize.minRow,
					maxRow: rawGridSize.maxRow,
				},
				connectedSatellites:
					this.#serviceController.satelliteTcp.clientCount + this.#serviceController.satelliteWebsocket.clientCount,
			},
		}

		try {
			const surfaceGroups = this.#surfacesController.getDevicesList()
			for (const surfaceGroup of surfaceGroups) {
				if (!surfaceGroup.surfaces) continue

				for (const surface of surfaceGroup.surfaces) {
					if (surface.id && surface.isConnected) {
						// remove leading "satellite-" from satellite device serial numbers.
						const serialNumber = surface.id.replace('satellite-', '')

						// Collect info about the type of the surface
						payload.surfaces.push({
							id: serialNumber,
							moduleId: surface.integrationType || '', // Future: update to the real moduleId once merged
							description: surface.type || '',
						})
					}
				}
			}
		} catch (e) {
			this.#logger.error('Error collecting surfaces', e)
			Sentry.captureException(e)
		}

		try {
			const moduleVersionCounts = this.#instancesController.getConnectionsMetrics()
			for (const [moduleId, counts] of Object.entries(moduleVersionCounts)) {
				if (!moduleId || !counts) continue

				payload.connections.push({
					moduleId,
					counts,
				})
			}
		} catch (e) {
			this.#logger.error('Error collecting module versions', e)
			Sentry.captureException(e)
		}

		return payload
	}

	/**
	 * Run reporting cycle
	 */
	#cycle() {
		this.#logger.silly('cycle')

		try {
			const payload = this.#buildPayload()

			// push metrics back home - if we can!
			pRetry(
				async () => {
					const res = await this.#openApiClient.POST('/companion/detailed-usage', {
						body: payload,
						signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
					})

					if (res.error) {
						// Throwing an error here will trigger a retry
						throw new Error(res.error.message)
					}

					if (!res.data.ok) {
						throw new Error('Update server did not accept metrics')
					}

					this.#logger.silly(`usage metrics posted`)
				},
				{
					retries: 2,
					minTimeout: 5 * 60 * 1000,
					maxTimeout: 10 * 60 * 1000,
					maxRetryTime: REQUEST_TIMEOUT_MS * 2,
					onFailedAttempt: (error) => {
						if ((error instanceof Error && error.name === 'AbortError') || error instanceof AbortError) {
							this.#logger.verbose(`usage metrics aborted after ${REQUEST_TIMEOUT_MS}ms`)
						} else {
							this.#logger.verbose('usage metrics server said something unexpected!', error)
						}
					},
				}
			).catch(() => {
				this.#logger.warn('All usage metrics request attempts failed')
			})
		} catch (e) {
			this.#logger.error('Error during metrics cycle', e)
			Sentry.captureException(e)
		}
	}

	#cycleStop: (() => void) | undefined

	/**
	 * Start the reporting cycle
	 */
	startStopCycle(): void {
		const shouldRun = this.#userConfigController.getKey('detailed_data_collection')
		if (!shouldRun) {
			this.#logger.info('Stopping usage statistics cycle')

			this.#cycleStop?.()
			return
		}

		this.#logger.info('Starting usage statistics cycle')

		// If already running, stop first
		this.#cycleStop?.()

		// don't bother with pushing metrics in the startup phase, let's give the system a chance to start up
		const timeout = setTimeout(() => this.#cycle(), 1000 * 120)

		// after this, we'll push metrics every 60 minutes
		const interval = setInterval(() => this.#cycle(), 1000 * 60 * 60)

		this.#cycleStop = () => {
			clearTimeout(timeout)
			clearInterval(interval)
			this.#cycleStop = undefined
		}
	}

	updateUserConfig(key: keyof UserConfigModel, _value: boolean | number | string): void {
		if (key === 'detailed_data_collection') {
			this.startStopCycle()
		}
	}

	createTrpcRouter() {
		return router({
			getCurrentPayload: publicProcedure.query(() => {
				return this.#buildPayload()
			}),
		})
	}
}
