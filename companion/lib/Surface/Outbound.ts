import { nanoid } from 'nanoid'
import LogController from '../Log/Controller.js'
import type { DataDatabase } from '../Data/Database.js'
import type {
	CompanionSurfaceConfigField,
	OutboundSurfaceInfo,
	OutboundSurfacesUpdate,
} from '@companion-app/shared/Model/Surfaces.js'
import type { DataStoreTableView } from '../Data/StoreBase.js'
import { publicProcedure, router, toIterable } from '../UI/TRPC.js'
import z from 'zod'
import { EventEmitter } from 'node:events'
import { OutboundSurfaceCollections } from './OutboundCollections.js'
import { isEqual } from 'lodash-es'
import { ServiceSurfaceDiscovery } from './Discovery.js'
import { ParseExpression } from '@companion-app/shared/Expression/ExpressionParse.js'
import { ResolveExpression } from '@companion-app/shared/Expression/ExpressionResolve.js'
import { ExpressionFunctions } from '@companion-app/shared/Expression/ExpressionFunctions.js'

export interface SurfaceOutboundControllerEvents {
	clientInfo: [update: OutboundSurfacesUpdate]
	[id: `startStop:${string}`]: [info: OutboundSurfaceInfo]
}
export class SurfaceOutboundController {
	/**
	 * The logger for this class
	 */
	readonly #logger = LogController.createLogger('SurfaceOutboundController')

	readonly #collections: OutboundSurfaceCollections

	readonly #discoveryController = new ServiceSurfaceDiscovery()

	/**
	 * The core database library
	 */
	readonly #dbTable: DataStoreTableView<Record<string, OutboundSurfaceInfo>>

	#storage = new Map<string, OutboundSurfaceInfo>()

	readonly #surfaceInstancesInfo = new Map<
		string,
		{
			moduleId: string
			defaultConfig: Record<string, any>
			configMatchExpression: string | null
		}
	>()

	readonly events = new EventEmitter<SurfaceOutboundControllerEvents>()
	readonly #enabledConnectionIds = new Set<string>()

	get discovery(): ServiceSurfaceDiscovery {
		return this.#discoveryController
	}

	constructor(db: DataDatabase) {
		this.#dbTable = db.getTableView('surfaces_remote')

		this.events.setMaxListeners(0)

		this.#collections = new OutboundSurfaceCollections(
			db,
			(validCollectionIds) => this.#cleanUnknownCollectionIds(validCollectionIds),
			() => {
				// // Emit event to trigger feedback updates for outbound surface collection enabled states
				// this.events.emit('clientInfo', {
				// 	type: 'init',
				// 	items: this.#storage,
				// })
			}
		)

		this.#collections = new OutboundSurfaceCollections(
			db,
			(validCollectionIds) => this.#cleanUnknownCollectionIds(validCollectionIds),
			() => this.#startStopAllConnections()
		)
	}

	#cleanUnknownCollectionIds(validCollectionIds: ReadonlySet<string>): void {
		// Figure out the first sort order
		let nextSortOrder = 0
		for (const config of this.#storage.values()) {
			if (config && !config?.collectionId) {
				nextSortOrder = Math.max(nextSortOrder, config.sortOrder + 1)
			}
		}

		// Validate the collectionIds, and do something sensible with the sort order
		// Future: maybe this could try to preserve the order in some way?
		for (const [id, config] of this.#storage) {
			if (config && config.collectionId && !validCollectionIds.has(config.collectionId)) {
				config.collectionId = null
				config.sortOrder = nextSortOrder++

				this.events.emit('clientInfo', {
					type: 'add',
					itemId: id,
					info: config,
				})
				this.#startStopConnection(config)
			}
		}
	}

	/**
	 * Initialize the module, loading the configuration from the db
	 * @access public
	 */
	init(): void {
		this.#storage = new Map(Object.entries(this.#dbTable.all()))

		let sortOrderCounter = 0
		for (const surfaceInfo of this.#storage.values()) {
			// Fixup old config
			if (surfaceInfo.collectionId === undefined) surfaceInfo.collectionId = null
			if (surfaceInfo.sortOrder === undefined) surfaceInfo.sortOrder = sortOrderCounter
			sortOrderCounter++

			if (surfaceInfo.enabled === undefined) surfaceInfo.enabled = true // Fixup old config

			if (!surfaceInfo.enabled) {
				this.#logger.info(`Skipping disabled remote surface: ${surfaceInfo.displayName || surfaceInfo.id}`)
				continue
			}

			try {
				this.#startStopConnection(surfaceInfo)
			} catch (e) {
				this.#logger.error(`Unable to setup remote surface: ${surfaceInfo.displayName || surfaceInfo.id}: ${e}`)
			}
		}
	}

	exportAll(): Record<string, OutboundSurfaceInfo> {
		return Object.fromEntries(this.#storage)
	}

	updateDefaultConfigForSurfaceInstance(
		instanceId: string,
		moduleId: string,
		info: {
			configFields: CompanionSurfaceConfigField[]
			configMatchesExpression: string | null
		} | null
	): void {
		if (info) {
			// Compute default config for the instance
			const config: Record<string, any> = {}
			for (const fieldDef of info.configFields) {
				// Handle different field types that have default values
				if ('default' in fieldDef && fieldDef.default !== undefined) {
					config[fieldDef.id] = fieldDef.default
				}
			}

			this.#surfaceInstancesInfo.set(instanceId, {
				moduleId: moduleId,
				defaultConfig: config,
				configMatchExpression: info.configMatchesExpression,
			})
		} else {
			this.#surfaceInstancesInfo.delete(instanceId)
		}
	}

	#startStopAllConnections(): void {
		for (const surfaceInfo of this.#storage.values()) {
			this.#startStopConnection(surfaceInfo)
		}
	}

	#startStopConnection(connectionInfo: OutboundSurfaceInfo): void {
		const enabled = connectionInfo.enabled && this.#collections.isCollectionEnabled(connectionInfo.collectionId)
		if (enabled === this.#enabledConnectionIds.has(connectionInfo.id)) {
			// No change
			return
		}

		if (enabled) {
			this.#enabledConnectionIds.add(connectionInfo.id)
		} else {
			this.#enabledConnectionIds.delete(connectionInfo.id)
		}

		this.events.emit(`startStop:${connectionInfo.instanceId}`, connectionInfo)
	}

	createTrpcRouter() {
		const self = this
		return router({
			discovery: this.#discoveryController.createTrpcRouter(),

			collections: this.#collections.createTrpcRouter(),

			watch: publicProcedure.subscription(async function* ({ signal }) {
				const changes = toIterable(self.events, 'clientInfo', signal)

				// Initial data
				yield { type: 'init', items: Object.fromEntries(self.#storage) } satisfies OutboundSurfacesUpdate

				for await (const [data] of changes) {
					yield data
				}
			}),

			add: publicProcedure
				.input(
					z.object({
						instanceId: z.string(),
						connectionId: z.string().optional(),
					})
				)
				.mutation(async ({ input }) => {
					this.#logger.info(`Adding new Remote Surface Connection for ${input.instanceId} (${input.connectionId})`)

					const instanceInfo = this.#surfaceInstancesInfo.get(input.instanceId)
					if (!instanceInfo)
						return { ok: false, error: 'Surface integration does not support remote connections' } as const

					let displayName = 'New Remote Surface'
					let config = instanceInfo.defaultConfig
					if (input.connectionId) {
						const connectionInfo = this.discovery.getInfoForConnectionId(input.instanceId, input.connectionId)
						if (!connectionInfo) {
							this.#logger.warn(`Unknown connection ID ${input.connectionId} for instance ${input.instanceId}`)
							return { ok: false, error: 'Unknown connection' } as const
						}

						displayName = connectionInfo.displayName
						config = connectionInfo.config

						// Check if an existing surface matches this config
						if (this.#doesExistingSurfaceMatchNewConfig(input.instanceId, config)) {
							return { ok: false, error: 'A connection with matching configuration already exists' } as const
						}
					}

					const highestRank =
						Math.max(
							0,
							...Array.from(this.#storage.values())
								.map((c) => (c?.collectionId ? c.sortOrder : null))
								.filter((n) => typeof n === 'number')
						) || 0

					const id = nanoid()
					const newInfo: OutboundSurfaceInfo = {
						id,
						type: 'plugin',
						enabled: true,
						displayName: displayName,
						moduleId: instanceInfo.moduleId,
						instanceId: input.instanceId,
						config: structuredClone(config ?? {}),
						sortOrder: highestRank + 1,
						collectionId: null,
					}

					this.addOutboundConnection(newInfo)

					return { ok: true, id } as const
				}),

			remove: publicProcedure
				.input(
					z.object({
						id: z.string(),
					})
				)
				.mutation(async ({ input }) => {
					const { id } = input

					const surfaceInfo = this.#storage.get(id)
					if (!surfaceInfo) return // Not found, pretend all was ok

					this.#storage.delete(id)
					this.#dbTable.delete(id)

					this.events.emit('clientInfo', {
						type: 'remove',
						itemId: id,
					})

					this.#startStopConnection({ ...surfaceInfo, enabled: false }) // Stop the connection
				}),

			setEnabled: publicProcedure
				.input(
					z.object({
						id: z.string(),
						enabled: z.boolean(),
					})
				)
				.mutation(async ({ input }) => {
					const { id, enabled } = input

					const surfaceInfo = this.#storage.get(id)
					if (!surfaceInfo) throw new Error('Surface not found')

					surfaceInfo.enabled = !!enabled
					this.#dbTable.set(id, surfaceInfo)

					// Start/stop the connection
					this.#startStopConnection(surfaceInfo)

					this.events.emit('clientInfo', {
						type: 'add',
						itemId: id,

						info: surfaceInfo,
					})
				}),

			saveConfig: publicProcedure
				.input(
					z.object({
						id: z.string(),
						name: z.string(),
						config: z.record(z.string(), z.any()),
					})
				)
				.mutation(async ({ input }) => {
					const existing = this.#storage.get(input.id)
					if (!existing) throw new Error('Remote Surface not found')

					// Stop the connection with the old config
					const shouldRestart = existing.enabled && !isEqual(existing.config, input.config)
					if (shouldRestart) {
						this.#startStopConnection({ ...existing, enabled: false })
					}

					existing.displayName = input.name
					existing.config = input.config

					this.#dbTable.set(input.id, existing)

					// Start with the new config
					if (shouldRestart) {
						this.#startStopConnection(existing)
					}

					this.events.emit('clientInfo', {
						type: 'add',
						itemId: input.id,
						info: existing,
					})
				}),

			reorder: publicProcedure
				.input(
					z.object({
						collectionId: z.string().nullable(),
						connectionId: z.string(),
						dropIndex: z.number(),
					})
				)
				.mutation(async ({ input }) => {
					const { collectionId, connectionId, dropIndex } = input

					const thisConnection = this.#storage.get(connectionId)
					if (!thisConnection) return false

					if (!this.#collections.doesCollectionIdExist(collectionId)) return false

					// update the collectionId of the connection being moved if needed
					if (thisConnection.collectionId !== (collectionId ?? null)) {
						thisConnection.collectionId = collectionId

						this.#startStopConnection(thisConnection)

						this.#dbTable.set(connectionId, thisConnection)
						this.events.emit('clientInfo', {
							type: 'add',
							itemId: connectionId,
							info: thisConnection,
						})
					}

					// find all the other connections with the matching collectionId
					const sortedConnections = Array.from(this.#storage.values())
						.filter(
							(connection) =>
								connection.id !== connectionId &&
								((!connection.collectionId && !collectionId) || connection.collectionId === collectionId)
						)
						.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))

					if (dropIndex < 0) {
						// Push the connection to the end of the array
						sortedConnections.push(thisConnection)
					} else {
						// Insert the connection at the drop index
						sortedConnections.splice(dropIndex, 0, thisConnection)
					}

					// update the sort order of the connections in the store, tracking which ones changed
					sortedConnections.forEach((connection, index) => {
						if (connection.sortOrder === index) return // No change

						connection.sortOrder = index
						this.#dbTable.set(connection.id, connection)
						this.events.emit('clientInfo', {
							type: 'add',
							itemId: connection.id,
							info: connection,
						})
					})

					return true
				}),
		})
	}

	addOutboundConnection(newInfo: OutboundSurfaceInfo): void {
		if (this.#storage.has(newInfo.id)) throw new Error(`Outbound surface with ID ${newInfo.id} already exists`)

		this.#storage.set(newInfo.id, newInfo)
		this.#dbTable.set(newInfo.id, newInfo)

		this.events.emit('clientInfo', {
			type: 'add',
			itemId: newInfo.id,

			info: newInfo,
		})

		this.#startStopConnection(newInfo)
	}

	getAllEnabledConnectionsForInstance(instanceId: string): OutboundSurfaceInfo[] {
		return Array.from(this.#storage.values()).filter((surfaceInfo) => {
			return (
				surfaceInfo && surfaceInfo.type === 'plugin' && surfaceInfo.instanceId === instanceId && surfaceInfo.enabled
			)
		})
	}

	removeAllForSurfaceInstance(instanceId: string): void {
		for (const [connectionId, connectionInfo] of this.#storage) {
			if (!connectionInfo) continue // Safety check

			if (connectionInfo.type !== 'plugin' || connectionInfo.instanceId !== instanceId) continue

			// Cleanup connection
			this.#storage.delete(connectionId)
			this.#dbTable.delete(connectionId)
			this.#startStopConnection(connectionInfo)

			this.events.emit('clientInfo', {
				type: 'remove',
				itemId: connectionId,
			})
		}
	}

	reset(): void {
		this.events.emit('clientInfo', {
			type: 'init',
			items: {},
		})

		this.#storage.clear()
		this.#dbTable.clear()
	}

	quit(): void {
		this.#discoveryController.quit()
	}

	#doesExistingSurfaceMatchNewConfig(instanceId: string, config: Record<string, any>): boolean {
		const matchExpression = this.#surfaceInstancesInfo.get(instanceId)?.configMatchExpression
		if (!matchExpression) return false

		try {
			const expression = ParseExpression(matchExpression)
			const doesMatch = (otherConfig: Record<string, any>) => {
				try {
					const val = ResolveExpression(
						expression,
						(props) => {
							if (props.label === 'objA') {
								return config?.[props.name]
							} else if (props.label === 'objB') {
								return otherConfig[props.name]
							} else {
								throw new Error(`Unknown variable "${props.variableId}"`)
							}
						},
						ExpressionFunctions
					)
					return !!val && val !== 'false' && val !== '0'
				} catch (e) {
					console.error('Failed to resolve expression', e)
					return false
				}
			}

			// Find a surface which matches
			for (const surface of this.#storage.values()) {
				if (surface.type === 'plugin' && surface.instanceId === instanceId && doesMatch(surface.config)) {
					return true
				}
			}

			return false
		} catch (e) {
			this.#logger.warn(`Failed to process remoteConfigMatches expression: ${e}`)
			return false
		}
	}
}
