import { isEqual } from 'lodash-es'
import { CloudRegion, RegionInfo } from './Region.js'
import { v4 } from 'uuid'
import { xyToOldBankIndex } from '@companion-app/shared/ControlId.js'
import { delay } from '../Resources/Util.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import type { AppInfo } from '../Registry.js'
import type { DataCache, DataCacheDefaultTable } from '../Data/Cache.js'
import type { ImageResult } from '../Graphics/ImageResult.js'
import nodeMachineId from 'node-machine-id'
import LogController from '../Log/Controller.js'
import type { DataDatabase } from '../Data/Database.js'
import type { IPageStore } from '../Page/Store.js'
import type { ControlsController } from '../Controls/Controller.js'
import type { GraphicsController } from '../Graphics/Controller.js'
import type { DataStoreTableView } from '../Data/StoreBase.js'
import { publicProcedure, router, toIterable } from '../UI/TRPC.js'
import EventEmitter from 'node:events'
import z from 'zod'
import { CloudRegionState } from '@companion-app/shared/Model/Cloud.js'

const CLOUD_URL = 'https://api.bitfocus.io/v1'
const CLOUD_TABLE: string = 'cloud'

function generateMachineId() {
	try {
		return nodeMachineId.machineIdSync(true)
	} catch (e) {
		// The nodeMachineId call can fail if the machine has stricter security that blocks regedit
		// If that happens, fallback to a uuid, which while not stable, is better than nothing
		return v4()
	}
}

/**
 * The class that manages the Bitfocus Cloud functionality
 *
 * @author Håkon Nessjøen <haakon@bitfocus.io>
 * @author Keith Rocheck <keith.rocheck@gmail.com>
 * @author William Viker <william@bitfocus.io>
 * @author Julian Waller <me@julusian.co.uk>
 * @since 2.3.0
 * @copyright 2022 Bitfocus AS
 * @license
 * This program is free software.
 * You should have received a copy of the MIT licence as well as the Bitfocus
 * Individual Contributor License Agreement for Companion along with
 * this program.
 */

interface CloudAuthData {
	token: string
	user: string
	connections: { [region: string]: boolean }
	cloudActive: boolean
}

interface CloudDbTable {
	uuid: string
	auth: CloudAuthData
}

export type CloudUIEvents = {
	cloudState: [CloudControllerState]
	[id: `regionState:${string}`]: [CloudRegionState | null]
}

export class CloudController {
	readonly #logger = LogController.createLogger('Cloud/Controller')

	readonly appInfo: AppInfo
	readonly #dbTable: DataStoreTableView<CloudDbTable>
	readonly #cacheTable: DataStoreTableView<DataCacheDefaultTable>
	readonly controls: ControlsController
	readonly #graphics: GraphicsController
	readonly pageStore: IPageStore

	/**
	 * A clist of known cloud regions
	 */
	static availableRegions: { [region: string]: RegionInfo } = {}
	/**
	 * The cloud data store
	 */
	data: CloudAuthData
	/**
	 * Protocol version
	 */
	readonly protocolVersion = 1
	/**
	 * The current comapnion ID
	 */
	readonly companionId: string
	/**
	 * Array of known client IDs, with their last seen time
	 */
	knownIds = new Map<string, number>()
	/**
	 * Time of last client ID cleanup
	 */
	lastKnownIdCleanup: number = Date.now()
	/**
	 * The initialized region handlers
	 */
	#regionInstances: { [region: string]: CloudRegion } = {}
	/**
	 * The state object for the UI
	 */
	state: CloudControllerState = {
		uuid: '',
		authenticating: false,
		authenticated: false,
		authenticatedAs: '',
		ping: false,
		regions: [],
		tryUsername: '',
		tryPassword: '',
		error: null,
		cloudActive: false,
		canActivate: false,
	}

	readonly #uiEvents = new EventEmitter<CloudUIEvents>()

	constructor(
		appInfo: AppInfo,
		db: DataDatabase,
		cache: DataCache,
		controls: ControlsController,
		graphics: GraphicsController,
		pageStore: IPageStore
	) {
		this.appInfo = appInfo
		this.#dbTable = db.getTableView(CLOUD_TABLE)
		this.#cacheTable = cache.defaultTableView
		this.controls = controls
		this.#graphics = graphics
		this.pageStore = pageStore

		this.#uiEvents.setMaxListeners(0)

		this.data = this.#dbTable.getOrDefault('auth', {
			token: '',
			user: '',
			connections: {},
			cloudActive: false,
		})

		this.companionId = appInfo.machineId
		const uuid = this.#dbTable.getPrimitiveOrDefault('uuid', generateMachineId())
		this.#setState({ uuid })

		const regions = this.#cacheTable.getOrDefault('cloud_servers', {})

		if (regions !== undefined) {
			for (const region of Object.values<any>(regions)) {
				if (region.id && region.label && region.hostname) {
					CloudController.availableRegions[region.id] = { host: region.hostname, name: region.label }
				}
			}
		}

		this.#setupRegions()

		if (this.data.token) {
			this.#handleCloudRefresh(this.data.token)
		}

		if (this.data.user) {
			this.#setState({ authenticatedAs: this.data.user })
		}

		this.#handleCloudInfrastructureRefresh()

		// Refresh every 24 hours
		setInterval(this.#handlePeriodicRefresh.bind(this), 3600e3 * 24)

		// Ping every second, if someone is watching
		setInterval(this.#timerTick.bind(this), 1000)

		this.#graphics.on('button_drawn', this.#updateBank.bind(this))

		this.#updateAllBanks()

		this.pageStore.on('pageDataChanged', this.#handlePageNameUpdate.bind(this))
	}

	createTrpcRouter() {
		const self = this
		return router({
			watchState: publicProcedure.subscription(async function* ({ signal }) {
				const changes = toIterable(self.#uiEvents, 'cloudState', signal)

				const modifyState = (state: CloudControllerState): CloudControllerState => ({
					...state,
					tryPassword: '', // Don't leak password in state
				})

				// TODO - set ping: true while active

				yield modifyState(self.state)

				for await (const [change] of changes) {
					yield modifyState(change)
				}
			}),

			setCloudActive: publicProcedure
				.input(
					z.object({
						active: z.boolean(),
					})
				)
				.mutation(({ input }) => {
					this.#logger.silly('setCloudActive', input)
					this.#setState({ cloudActive: input.active })
				}),

			regenerateUUID: publicProcedure.mutation(async () => {
				this.#handleCloudRegenerateUUID()
			}),

			login: publicProcedure
				.input(
					z.object({
						email: z.string(),
						password: z.string(),
					})
				)
				.mutation(async ({ input }) => {
					await this.#handleCloudLogin(input.email, input.password)
				}),
			logout: publicProcedure.mutation(async () => {
				this.#handleCloudLogout()
			}),

			watchRegionState: publicProcedure
				.input(
					z.object({
						regionId: z.string(),
					})
				)
				.subscription(async function* ({ input, signal }) {
					const changes = toIterable(self.#uiEvents, `regionState:${input.regionId}`, signal)

					// Emit the current state
					yield self.#regionInstances[input.regionId]?.state ?? null

					for await (const [change] of changes) {
						yield change
					}
				}),

			setRegionEnabled: publicProcedure
				.input(
					z.object({
						regionId: z.string(),
						enabled: z.boolean(),
					})
				)
				.mutation(({ input }) => {
					this.#logger.silly(`setRegionEnabled: ${input.regionId}`, input.enabled)
					if (this.#regionInstances[input.regionId] !== undefined) {
						this.#regionInstances[input.regionId].setState({
							enabled: input.enabled,
							cloudActive: this.state.cloudActive,
						})
					}
					const activeRegions = Object.values(this.#regionInstances).filter((r) => r.state.enabled).length
					this.#setState({ canActivate: activeRegions >= 2 })
				}),
		})
	}

	/**
	 * Disconnect and cleanup all the regions
	 */
	destroy(): void {
		for (let region in this.#regionInstances) {
			try {
				this.#regionInstances[region].destroy()
			} catch (e: any) {
				this.#logger.silly(`couldn't destroy region ${region}: ${e.message}`)
			}
		}
	}

	// /**
	//  * Get the current page names
	//  */
	// getPages(): Record<string, string> {
	// 	const reduceinit: Record<string, string> = {}
	// 	const pages = this.registry.page.getAll(false) ?? {}

	// 	return Object.entries(pages).reduce((acc, [key, page]) => {
	// 		if (page) acc[key] = page.name
	// 		return acc
	// 	}, reduceinit)
	// }

	/**
	 * Get the current bank database
	 * @returns the bank database
	 */
	getBanks(): object[] {
		const retval = []

		for (const controlId of this.controls.getAllControls().keys()) {
			const location = this.pageStore.getLocationOfControlId(controlId)
			if (!location) {
				continue
			}

			const control = this.controls.getControl(controlId)
			if (!control) {
				continue
			}
			if (control.type !== 'button') {
				continue
			}
			const drawStyle = control.getDrawStyle()
			if (!drawStyle || drawStyle.style !== 'button') {
				continue
			}

			// Don't expose a cloud control
			if (drawStyle.cloud) {
				continue
			}

			const bankIndex = xyToOldBankIndex(location.column, location.row)

			retval.push({
				location,
				bank: bankIndex, // backwards compatibility, TODO: remove in release
				page: location.pageNumber, // backwards compatibility, remove in release
				p: this.protocolVersion,
				data: {
					...drawStyle,
					pushed: control.supportsPushed && control.pushed,
					actions_running: drawStyle.action_running,
					bank_status: control.supportsStyle && control.button_status,
					style: 'button',
				},
			})
		}

		return retval
	}

	/**
	 * Request the current infrastructure information
	 */
	async #handleCloudInfrastructureRefresh(): Promise<void> {
		try {
			const url = new URL(CLOUD_URL + '/infrastructure/cloud/regions')
			if (process.env.NODE_ENV !== 'production') url.searchParams.append('testing', 'true')

			const responseBody = await fetch(url, {
				method: 'GET',
				headers: {
					accept: 'application/json',
					'content-type': 'application/json',
				},
			}).then(async (response) => response.json())

			const result: any = responseBody
			this.#logger.silly('Cloud setup: ', result)

			if (result.regions) {
				const regions = result.regions

				this.#cacheTable.set('cloud_servers', regions)

				CloudController.availableRegions = {}

				for (const region of regions) {
					if (region.id && region.label && region.hostname) {
						CloudController.availableRegions[region.id] = { host: region.hostname, name: region.label }
					}
				}

				// Find any substitutions
				const legacySubstitution = result.regionLegacySubstitution

				if (legacySubstitution !== undefined) {
					for (const oldId in legacySubstitution) {
						if (this.#regionInstances[oldId]) {
							this.#regionInstances[legacySubstitution[oldId]] = this.#regionInstances[oldId]
							delete this.#regionInstances[oldId]
						}

						if (this.data.connections[oldId]) {
							this.data.connections[legacySubstitution[oldId]] = this.data.connections[oldId]
							delete this.data.connections[oldId]
						}
					}
				}

				// Delete removed regions
				for (const id in this.#regionInstances) {
					if (CloudController.availableRegions[id] === undefined) {
						this.#regionInstances[id].destroy()
						delete this.#regionInstances[id]
					}
				}

				// Create new and update existing regions
				let newRegions = []
				try {
					if (CloudController.availableRegions) {
						for (const id in CloudController.availableRegions) {
							newRegions.push(id)
							if (this.#regionInstances[id] !== undefined) {
								this.#regionInstances[id].updateSetup(CloudController.availableRegions[id])
							} else {
								this.#regionInstances[id] = new CloudRegion(
									this,
									this.#uiEvents,
									id,
									CloudController.availableRegions[id]
								)
							}
						}
					}
				} catch (e: any) {
					this.#logger.silly(e.message)
				}

				this.#setState({ regions: newRegions })
				this.#readConnections(this.data.connections)
			}
		} catch (e) {
			this.#logger.silly('Cloud infrastructure error: ', e)
		}
	}

	/**
	 * Change UUID of this companion instance
	 */
	async #handleCloudRegenerateUUID(): Promise<void> {
		const newUuid = v4()
		this.#setState({ uuid: newUuid })
		this.#dbTable.setPrimitive('uuid', newUuid)

		this.#setState({ cloudActive: false })
		await delay(1000)
		this.#setState({ cloudActive: true })
	}

	/**
	 * Handle a page name update
	 * @param _id - the page ID
	 * @param _name - the new name
	 */
	#handlePageNameUpdate(_pageNumber: number): void {
		for (let region in this.#regionInstances) {
			if (!!this.#regionInstances[region]?.socketTransmit) {
				//TODO: Push page name
			}
		}
	}

	/**
	 * Process a login request from the UI
	 * @param email - the login email
	 * @param password - the login password
	 */
	async #handleCloudLogin(email: string, password: string): Promise<void> {
		let responseObject: any

		this.#setState({ error: null, authenticating: true })
		try {
			responseObject = await fetch(CLOUD_URL + '/auth/login', {
				method: 'POST',
				headers: {
					accept: 'application/json',
					'content-type': 'application/json',
				},
				body: JSON.stringify({ email, password }),
			}).then(async (response) => response.json())
		} catch (e: any) {
			if (e.response?.statusCode >= 400 && e.response?.statusCode < 500) {
				this.#setState({
					authenticated: false,
					authenticating: false,
					error: e.response?.body?.message || 'Invalid email or password',
				})
			} else {
				this.#setState({
					authenticated: false,
					authenticating: false,
					error: 'Could not connect to the cloud',
				})
			}
			this.destroy()
			return
		}

		try {
			this.#logger.silly('Cloud result: ', responseObject)
			if (responseObject.token !== undefined) {
				this.data.token = responseObject.token
				this.data.user = email
				this.#dbTable.set('auth', this.data)
				this.#setState({ authenticated: true, authenticating: false, authenticatedAs: email, error: null })
				this.#readConnections(this.data.connections)
			} else {
				this.#setState({ authenticated: false, authenticating: false, error: responseObject.message })
				this.destroy()
			}
		} catch (e: any) {
			this.#logger.error(`Cloud error: ${e.message}`)
			this.#setState({ authenticated: false, authenticating: false, error: JSON.stringify(e) })
			this.destroy()
		}
	}

	/**
	 * Process a logout request for the UI
	 */
	#handleCloudLogout(): void {
		this.data.user = ''
		this.data.token = ''
		this.data.connections = {}
		this.data.cloudActive = false
		this.#dbTable.set('auth', this.data)

		this.#setState({
			authenticated: false,
			authenticatedAs: '',
			authenticating: false,
			cloudActive: false,
		})

		for (const id in this.#regionInstances) {
			this.#regionInstances[id].setState({ enabled: false })
		}

		this.destroy()
	}

	/**
	 * Request an updated token from the cloud service
	 * @param token - the current session token
	 */
	async #handleCloudRefresh(token: string): Promise<void> {
		// For transparency, show the user that we're refreshing
		this.#setState({ authenticating: true })
		try {
			const result: any = await fetch(CLOUD_URL + '/refresh', {
				method: 'POST',
				headers: {
					accept: 'application/json',
					'content-type': 'application/json',
					authorization: `Bearer ${token}`,
				},

				body: '{}',
			}).then(async (response) => response.json())

			this.#logger.silly('Cloud result: ', result)

			if (result.token) {
				this.data.token = result.token
				this.#dbTable.set('auth', this.data)
				this.#setState({
					authenticated: true,
					authenticatedAs: result.customer?.email,
					authenticating: false,
					error: null,
					cloudActive: this.data.cloudActive,
				})
				this.#readConnections(this.data.connections)
			} else {
				this.#setState({
					authenticated: false,
					authenticating: false,
					error: 'Cannot refresh login token, please login again.',
				})
			}
		} catch (e: any) {
			this.#logger.error(`Cloud refresh error: ${e.message}`)
			this.#setState({
				authenticated: false,
				authenticating: false,
				error: 'Cannot reach authentication/cloud-api server',
			})
			this.destroy()
			return
		}
	}

	/**
	 * If a token exists, refresh it
	 */
	async #handlePeriodicRefresh(): Promise<void> {
		if (this.data.token) {
			await this.#handleCloudInfrastructureRefresh()
			await this.#handleCloudRefresh(this.data.token)
		}
	}

	/**
	 * Send enable information from the DB to the regions
	 * @param connections - the region enable information
	 */
	#readConnections(connections: { [region: string]: boolean }): void {
		this.#logger.silly('READ CONNECTIONS', connections)
		if (connections) {
			for (let region in connections) {
				this.#logger.silly(`Has region: ${region}`, region in this.#regionInstances)
				if (this.#regionInstances[region]) {
					this.#regionInstances[region].setState({ enabled: connections[region], cloudActive: this.state.cloudActive })
				}
			}
			const activeRegions = Object.values(this.#regionInstances).filter((r) => r.state.enabled).length
			this.#setState({ canActivate: activeRegions >= 2 })
		}
	}

	/**
	 * Save region enable state information
	 */
	saveConnection(region: string, enabled: boolean): void {
		if (this.data.connections === undefined) {
			this.data.connections = {}
		}

		this.data.connections[region] = enabled

		this.#dbTable.set('auth', this.data)
	}

	/**
	 * Merge and transmit new state information
	 * @param draftState - the updated state(s)
	 */
	#setState(draftState: Partial<CloudControllerState>): void {
		const oldState: CloudControllerState = { ...this.state }
		const newState: CloudControllerState = {
			...this.state,
			...draftState,
		}

		if (draftState.cloudActive && !oldState.canActivate) {
			// If canActivate is false, we can't activate cloud
			newState.cloudActive = oldState.cloudActive
		}

		if (!isEqual(newState, this.state)) {
			this.#uiEvents.emit('cloudState', newState)
			this.state = newState
		}

		if (oldState.cloudActive !== newState.cloudActive) {
			this.data.cloudActive = newState.cloudActive
			this.#dbTable.set('auth', this.data)

			if (newState.authenticated) {
				for (let region in this.#regionInstances) {
					this.#regionInstances[region].setState({ cloudActive: newState.cloudActive })
				}

				// Was authenticated when cloudActive was changed, so we can skip the next check in setState
				return
			}
		}

		if (this.data.token) {
			for (let region in this.#regionInstances) {
				let currentRegion = this.#regionInstances[region]

				if (oldState.authenticated !== newState.authenticated) {
					if (currentRegion.state?.enabled && newState.authenticated && newState.cloudActive) {
						// Force reload of the cloudActive state in region
						currentRegion.setState({ cloudActive: false })
						currentRegion.setState({ cloudActive: this.data.cloudActive })
					} else {
						currentRegion.destroy()
					}
				}
			}
		}
	}

	/**
	 * Initialize all the regions
	 */
	#setupRegions(): void {
		try {
			if (CloudController.availableRegions) {
				const regions: string[] = []

				for (const id in CloudController.availableRegions) {
					regions.push(id)
					this.#regionInstances[id] = new CloudRegion(this, this.#uiEvents, id, CloudController.availableRegions[id])
				}

				this.#setState({
					regions,
				})
			}
		} catch (e: any) {
			this.#logger.silly(e.message)
		}
	}

	/**
	 * If needed, ping all the regions
	 */
	#timerTick(): void {
		if (this.state.ping === true) {
			for (let region in this.#regionInstances) {
				try {
					this.#regionInstances[region].timerTick()
				} catch (e) {}
			}
		}
	}

	/**
	 * Get copies of all the current bank styles
	 */
	#updateAllBanks(): void {
		const updateId = v4()
		const data = this.getBanks()
		for (let region in this.#regionInstances) {
			if (!!this.#regionInstances[region]?.socketTransmit) {
				this.#regionInstances[region].socketTransmit('companion-banks:' + this.state.uuid, {
					updateId,
					type: 'full',
					data,
				})
			}
		}
	}

	/**
	 * Store and transmit an updated bank style
	 * @param location - the location of the control
	 * @param render
	 */
	#updateBank(location: ControlLocation, render: ImageResult): void {
		const bank = xyToOldBankIndex(location.column, location.row)
		if (typeof render.style === 'object' && !render.style.cloud && bank) {
			const updateId = v4()
			for (let region in this.#regionInstances) {
				if (!!this.#regionInstances[region]?.socketTransmit) {
					this.#regionInstances[region].socketTransmit('companion-banks:' + this.state.uuid, {
						updateId,
						type: 'single',
						location,
						p: this.protocolVersion,
						page: location.pageNumber, // backwards compatibility, remove in release
						bank, // backwards compatibility, remove in release
						data: render.style,
					})
				}
			}
		}
	}
}

export interface CloudControllerState {
	uuid: string
	authenticating: boolean
	authenticated: boolean
	authenticatedAs: string
	ping: boolean
	regions: string[]
	tryUsername: string
	tryPassword: string
	error: null | string
	cloudActive: boolean
	canActivate: boolean
}
