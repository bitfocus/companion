import { EventEmitter } from 'node:events'
import isEqual from 'fast-deep-equal'
import { nanoid } from 'nanoid'
import type { JsonValue } from 'type-fest'
import { resolveLinkTransportConfig } from '@companion-app/shared/LinkTransportConfig.js'
import type {
	LinkPermissions,
	LinkTransportConfig,
	LinkTransportState,
	LinkTransportStatesUpdate,
	LinkTransportsUpdate,
} from '@companion-app/shared/Model/Link.js'
import { stringifyError } from '@companion-app/shared/Stringify.js'
import type { DataDatabase } from '../Data/Database.js'
import type { DataStoreTableView } from '../Data/StoreBase.js'
import LogController from '../Log/Controller.js'
import type { LinkIdentity } from './Identity.js'
import type {
	LinkMessageOrigin,
	LinkPublishOptions,
	LinkTransport,
	LinkTransportLastWill,
	SomeLinkTransportDefinition,
} from './Transports/Types.js'

export type TransportManagerEvents = {
	/** A message arrived on a transport */
	message: [transportId: string, topic: string, payload: string, origin: LinkMessageOrigin]
	/** What a connection of a transport may use has changed */
	/** A transport connected, so anything that should be (re)sent on a new connection should be */
	transportConnected: [transportId: string]
	/** A transport stopped or lost its connection, so peers seen on it are no longer reachable through it */
	transportDisconnected: [transportId: string]
	configs: [update: LinkTransportsUpdate]
	states: [update: LinkTransportStatesUpdate]
}

interface RunningTransport {
	readonly transport: LinkTransport
	state: LinkTransportState
	/** Patterns subscribed on just this transport (see `subscribeOn`) */
	readonly ownSubscriptions: Set<string>
}

/**
 * Owns the configured transports: persisting their config, running the enabled ones, and fanning publishes and
 * subscriptions out to them. Nothing here knows about the Link protocol.
 */
export class LinkTransportManager {
	readonly events = new EventEmitter<TransportManagerEvents>()

	readonly #logger = LogController.createLogger('Link/TransportManager')

	readonly #definitions: ReadonlyMap<string, SomeLinkTransportDefinition>
	readonly #configTable: DataStoreTableView<Record<string, LinkTransportConfig>>
	readonly #storageTable: DataStoreTableView<Record<string, Record<string, JsonValue>>>

	readonly #configs = new Map<string, LinkTransportConfig>()
	/** The types of the transports that are part of Link, which the user can't add */
	readonly #builtinTypes = new Set<string>()
	readonly #running = new Map<string, RunningTransport>()
	/** Enabled transports that could not be started, eg because their config is incomplete */
	readonly #failed = new Map<string, LinkTransportState>()

	/** Reference counts of the patterns the core wants to receive, applied to every running transport */
	readonly #subscriptions = new Map<string, number>()

	readonly #identity: () => LinkIdentity
	readonly #selfName: () => string
	readonly #getPermissions: (peerId: string) => LinkPermissions
	readonly #lastWill: () => LinkTransportLastWill

	#started = false

	constructor(
		db: DataDatabase,
		definitions: readonly SomeLinkTransportDefinition[],
		identity: () => LinkIdentity,
		selfName: () => string,
		getPermissions: (peerId: string) => LinkPermissions,
		lastWill: () => LinkTransportLastWill
	) {
		this.events.setMaxListeners(0)

		this.#definitions = new Map(definitions.map((def) => [def.type, def]))
		this.#configTable = db.getTableView('link_transports')
		this.#storageTable = db.getTableView('link_transport_storage')
		this.#identity = identity
		this.#selfName = selfName
		this.#getPermissions = getPermissions
		this.#lastWill = lastWill

		for (const [id, config] of Object.entries(this.#configTable.all())) {
			// Only the transports the user added are saved
			this.#configs.set(id, { ...config, builtin: false })
		}
	}

	get definitions(): ReadonlyMap<string, SomeLinkTransportDefinition> {
		return this.#definitions
	}

	/** Start all the enabled transports */
	start(): void {
		this.#started = true
		for (const config of this.#configs.values()) this.#startStop(config)
	}

	/** Say goodbye on and stop all transports */
	async stopAll(): Promise<void> {
		this.#started = false
		await Promise.all(Array.from(this.#running.keys()).map(async (id) => this.#stop(id)))
	}

	/** Stop and start all transports, eg because our peer id changed */
	async restartAll(): Promise<void> {
		await this.stopAll()
		this.start()
	}

	getConfigs(): Record<string, LinkTransportConfig> {
		return Object.fromEntries(this.#configs)
	}

	getStates(): Record<string, LinkTransportState> {
		const states: Record<string, LinkTransportState> = {}
		for (const config of this.#configs.values()) states[config.id] = this.#getState(config.id)
		return states
	}

	getLabel(transportId: string): string | undefined {
		return this.#configs.get(transportId)?.label
	}

	isConnected(transportId: string): boolean {
		return this.#running.get(transportId)?.state.status === 'connected'
	}

	/**
	 * Set the config of a transport that is part of Link, (re)starting it if it changed. It is not saved, as it comes
	 * from the user config
	 * @param config - its config, or null when it is switched off
	 */
	async setBuiltin(
		id: string,
		type: string,
		label: string,
		config: Record<string, JsonValue | undefined> | null
	): Promise<void> {
		const existing = this.#configs.get(id)
		const updated: LinkTransportConfig = {
			id,
			type,
			label,
			enabled: config !== null,
			config: config ?? existing?.config ?? {},
			// Listed before the ones the user added
			sortOrder: -1,
			builtin: true,
		}
		if (existing && isEqual(existing, updated)) return

		this.#builtinTypes.add(type)
		this.#configs.set(id, updated)
		this.events.emit('configs', { type: 'add', itemId: id, info: updated })

		// Transports don't handle reconfiguration, so replace the running instance
		await this.#stop(id)
		if (this.#started) this.#startStop(updated)
		else this.#emitState(id)
	}

	/**
	 * Add a transport, and start it. The config is validated against the fields of the type
	 * @returns the id of the new transport, or the validation errors by field id if the config was rejected
	 */
	add(
		type: string,
		label: string,
		rawConfig: Record<string, JsonValue | undefined>
	): { ok: true; id: string } | { ok: false; errors: Record<string, string> } {
		const definition = this.#definitions.get(type)
		if (!definition || this.#builtinTypes.has(type)) throw new Error(`Unknown transport type "${type}"`)

		const { config, errors } = resolveLinkTransportConfig(definition.configFields, rawConfig)
		if (Object.keys(errors).length > 0) return { ok: false, errors }

		const sortOrder = Math.max(-1, ...Array.from(this.#configs.values(), (c) => c.sortOrder)) + 1

		const transport: LinkTransportConfig = {
			id: nanoid(),
			type,
			label,
			enabled: true,
			config,
			sortOrder,
			builtin: false,
		}
		this.#save(transport)
		this.#startStop(transport)

		return { ok: true, id: transport.id }
	}

	/**
	 * Update the label and config of a transport. The config is validated against the fields of the type
	 * @returns the validation errors by field id, if the config was rejected
	 */
	async update(
		id: string,
		label: string,
		rawConfig: Record<string, JsonValue | undefined>
	): Promise<{ ok: true } | { ok: false; errors: Record<string, string> }> {
		const existing = this.#getUserConfig(id)

		const definition = this.#definitions.get(existing.type)
		if (!definition) throw new Error(`Unknown transport type "${existing.type}"`)

		const { config, errors } = resolveLinkTransportConfig(definition.configFields, rawConfig)
		if (Object.keys(errors).length > 0) return { ok: false, errors }

		const updated: LinkTransportConfig = { ...existing, label, config }
		this.#save(updated)

		// Transports don't handle reconfiguration, so replace the running instance
		await this.#stop(id)
		this.#startStop(updated)

		return { ok: true }
	}

	async setEnabled(id: string, enabled: boolean): Promise<void> {
		const existing = this.#getUserConfig(id)

		const updated: LinkTransportConfig = { ...existing, enabled }
		this.#save(updated)

		if (!enabled) await this.#stop(id)
		this.#startStop(updated)
	}

	async remove(id: string): Promise<void> {
		if (!this.#configs.has(id)) return
		this.#getUserConfig(id)

		await this.#stop(id)

		this.#configs.delete(id)
		this.#failed.delete(id)
		this.#configTable.delete(id)
		this.#storageTable.delete(id)

		this.events.emit('configs', { type: 'remove', itemId: id })
		this.events.emit('states', { type: 'remove', itemId: id })
	}

	/**
	 * Pass an action the user chose on an entry reported by a transport
	 * @returns an error to show the user, or null on success
	 */
	async handleSectionAction(
		id: string,
		entryId: string,
		actionId: string,
		input: string | null
	): Promise<string | null> {
		const running = this.#running.get(id)
		if (!running) return 'The transport is not running'

		try {
			return await running.transport.handleSectionAction(entryId, actionId, input)
		} catch (e) {
			this.#logger.warn(`Action ${actionId} on transport ${id} failed: ${stringifyError(e)}`)
			return stringifyError(e)
		}
	}

	/** Publish a message on every connected transport */
	publishAll(topic: string, payload: string, options: LinkPublishOptions): void {
		for (const id of this.#running.keys()) this.publishTo(id, topic, payload, options)
	}

	/** Publish a message on one transport, if it is connected */
	publishTo(transportId: string, topic: string, payload: string, options: LinkPublishOptions): void {
		const running = this.#running.get(transportId)
		if (!running || running.state.status !== 'connected') return

		try {
			running.transport.publish(topic, payload, options)
		} catch (e) {
			this.#logger.warn(`Publish on transport ${transportId} failed: ${stringifyError(e)}`)
		}
	}

	/** Receive messages matching a pattern from all transports. Calls are reference counted */
	subscribe(pattern: string): void {
		const count = this.#subscriptions.get(pattern) ?? 0
		this.#subscriptions.set(pattern, count + 1)
		if (count > 0) return

		for (const [id, running] of this.#running) this.#callTransport(id, () => running.transport.subscribe(pattern))
	}

	unsubscribe(pattern: string): void {
		const count = this.#subscriptions.get(pattern)
		if (count === undefined) return
		if (count > 1) {
			this.#subscriptions.set(pattern, count - 1)
			return
		}

		this.#subscriptions.delete(pattern)
		for (const [id, running] of this.#running) {
			if (!running.ownSubscriptions.has(pattern)) this.#callTransport(id, () => running.transport.unsubscribe(pattern))
		}
	}

	/**
	 * Receive messages matching a pattern from one transport only, eg the one a peer is reached through. Forgotten
	 * when the transport stops
	 */
	subscribeOn(transportId: string, pattern: string): void {
		const running = this.#running.get(transportId)
		if (!running || running.ownSubscriptions.has(pattern)) return

		running.ownSubscriptions.add(pattern)
		if (!this.#subscriptions.has(pattern)) this.#callTransport(transportId, () => running.transport.subscribe(pattern))
	}

	unsubscribeFrom(transportId: string, pattern: string): void {
		const running = this.#running.get(transportId)
		if (!running?.ownSubscriptions.delete(pattern)) return

		if (!this.#subscriptions.has(pattern))
			this.#callTransport(transportId, () => running.transport.unsubscribe(pattern))
	}

	/** The config of a transport the user added, as only those can be changed by the user */
	#getUserConfig(id: string): LinkTransportConfig {
		const existing = this.#configs.get(id)
		if (!existing) throw new Error(`Unknown transport "${id}"`)
		if (existing.builtin) throw new Error(`"${existing.label}" is configured in the settings`)
		return existing
	}

	#save(config: LinkTransportConfig): void {
		this.#configs.set(config.id, config)
		this.#configTable.set(config.id, config)
		this.events.emit('configs', { type: 'add', itemId: config.id, info: config })
	}

	#getState(id: string): LinkTransportState {
		return (
			this.#running.get(id)?.state ??
			this.#failed.get(id) ?? { status: 'disabled', message: null, info: [], sections: [] }
		)
	}

	#emitState(id: string): void {
		this.events.emit('states', { type: 'update', itemId: id, state: this.#getState(id) })
	}

	#startStop(config: LinkTransportConfig): void {
		this.#failed.delete(config.id)
		if (!config.enabled || this.#running.has(config.id)) {
			this.#emitState(config.id)
			return
		}

		const definition = this.#definitions.get(config.type)
		if (!definition) {
			this.#logger.warn(`Transport "${config.label}" has unknown type "${config.type}"`)
			return
		}
		if (!config.builtin && this.#builtinTypes.has(config.type)) {
			// Added before this kind of transport was part of Link, so it would clash with the built-in one
			this.#setFailed(
				config.id,
				`${definition.name} are now part of Link, and configured in Settings, under Protocols. Delete this transport.`
			)
			return
		}

		// Fill in defaults for any fields added since the config was saved
		const { config: resolvedConfig, errors } = resolveLinkTransportConfig(definition.configFields, config.config)
		const invalidFields = definition.configFields.filter((field) => errors[field.id] !== undefined)
		if (invalidFields.length > 0) {
			this.#logger.warn(`Transport "${config.label}" has an invalid config: ${JSON.stringify(errors)}`)
			this.#setFailed(config.id, `Complete the settings: ${invalidFields.map((field) => field.label).join(', ')}`)
			return
		}

		const id = config.id
		const logger = LogController.createLogger(`Link/Transport/${config.label || id}`)
		const storageTable = this.#storageTable

		let running: RunningTransport | null = null
		const state: LinkTransportState = { status: 'connecting', message: null, info: [], sections: [] }

		try {
			const transport = definition.create(
				{
					logger,
					identity: this.#identity(),
					getName: this.#selfName,
					lastWill: this.#lastWill(),
					storage: {
						get: (key) => storageTable.get(id)?.[key],
						set: (key, value) => storageTable.set(id, { ...storageTable.get(id), [key]: value }),
					},
					receive: (topic, payload, origin) => {
						if (running && this.#running.get(id) === running) {
							this.events.emit('message', id, topic, payload, origin)
						}
					},
					getPermissions: this.#getPermissions,
					setStatus: (status, message) => {
						const wasConnected = state.status === 'connected'
						state.status = status
						state.message = message
						if (!running || this.#running.get(id) !== running) return

						this.#emitState(id)
						if (status === 'connected' && !wasConnected) this.events.emit('transportConnected', id)
						if (status !== 'connected' && wasConnected) this.events.emit('transportDisconnected', id)
					},
					setInfo: (info) => {
						state.info = info
						if (running && this.#running.get(id) === running) this.#emitState(id)
					},
					setSections: (sections) => {
						state.sections = sections
						if (running && this.#running.get(id) === running) this.#emitState(id)
					},
				},
				resolvedConfig
			)
			running = { transport, state, ownSubscriptions: new Set() }
		} catch (e) {
			logger.error(`Failed to start: ${stringifyError(e)}`)
			this.#setFailed(id, stringifyError(e))
			return
		}

		this.#running.set(id, running)
		for (const pattern of this.#subscriptions.keys()) {
			this.#callTransport(id, () => running.transport.subscribe(pattern))
		}

		this.#emitState(id)
		if (state.status === 'connected') this.events.emit('transportConnected', id)
	}

	#setFailed(id: string, message: string): void {
		this.#failed.set(id, { status: 'error', message, info: [], sections: [] })
		this.#emitState(id)
	}

	async #stop(id: string): Promise<void> {
		this.#failed.delete(id)
		const running = this.#running.get(id)
		if (!running) return

		// Say goodbye, so that peers know we have gone rather than waiting for us to time out
		const lastWill = this.#lastWill()
		this.publishTo(id, lastWill.topic, lastWill.payload, { retain: lastWill.retain, requires: null })

		this.#running.delete(id)
		const wasConnected = running.state.status === 'connected'

		try {
			await running.transport.destroy()
		} catch (e) {
			this.#logger.warn(`Error stopping transport ${id}: ${stringifyError(e)}`)
		}

		this.#emitState(id)
		if (wasConnected) this.events.emit('transportDisconnected', id)
	}

	#callTransport(id: string, fn: () => void): void {
		try {
			fn()
		} catch (e) {
			this.#logger.warn(`Transport ${id} failed: ${stringifyError(e)}`)
		}
	}
}
