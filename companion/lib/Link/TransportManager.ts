import { EventEmitter } from 'node:events'
import { nanoid } from 'nanoid'
import type { JsonValue } from 'type-fest'
import type {
	LinkTransportConfig,
	LinkTransportState,
	LinkTransportStatesUpdate,
	LinkTransportsUpdate,
} from '@companion-app/shared/Model/Link.js'
import { stringifyError } from '@companion-app/shared/Stringify.js'
import type { DataDatabase } from '../Data/Database.js'
import type { DataStoreTableView } from '../Data/Tables/TableView.js'
import LogController from '../Log/Controller.js'
import type { LinkIdentity } from './Identity.js'
import { getDefaultLinkTransportConfig, resolveLinkTransportConfig } from './TransportConfig.js'
import type { LinkMessageOrigin, LinkTransport, SomeLinkTransportDefinition } from './Transports/Types.js'

export type TransportManagerEvents = {
	/** An installation announced itself on a transport, or said it has gone (null) */
	announcement: [transportId: string, peerId: string, payload: string | null]
	/** A message for this installation arrived on a transport */
	message: [transportId: string, payload: string, origin: LinkMessageOrigin]
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
}

/**
 * Owns the configured transports: persisting their config, running the enabled ones, and passing announcements and
 * messages to and from them. Nothing here knows about the Link protocol.
 */
export class LinkTransportManager {
	readonly events = new EventEmitter<TransportManagerEvents>()

	readonly #logger = LogController.createLogger('Link/TransportManager')

	readonly #definitions: ReadonlyMap<string, SomeLinkTransportDefinition>
	readonly #configTable: DataStoreTableView<Record<string, LinkTransportConfig>>
	readonly #storageTable: DataStoreTableView<Record<string, Record<string, JsonValue>>>

	readonly #configs = new Map<string, LinkTransportConfig>()
	readonly #running = new Map<string, RunningTransport>()
	/** Transports being stopped, which are no longer in #running */
	readonly #stopping = new Set<Promise<void>>()
	/** Enabled transports that could not be started, eg because their config is incomplete */
	readonly #failed = new Map<string, LinkTransportState>()

	readonly #identity: () => LinkIdentity
	readonly #selfName: () => string

	constructor(
		db: DataDatabase,
		definitions: readonly SomeLinkTransportDefinition[],
		identity: () => LinkIdentity,
		selfName: () => string
	) {
		this.events.setMaxListeners(0)

		this.#definitions = new Map(definitions.map((def) => [def.type, def]))
		this.#configTable = db.getTableView('link_transports')
		this.#storageTable = db.getTableView('link_transport_storage')
		this.#identity = identity
		this.#selfName = selfName

		for (const [id, config] of Object.entries(this.#configTable.all())) {
			this.#configs.set(id, config)
		}
	}

	get definitions(): ReadonlyMap<string, SomeLinkTransportDefinition> {
		return this.#definitions
	}

	/** Start all the enabled transports */
	start(): void {
		for (const config of this.#configs.values()) this.#startStop(config)
	}

	/** Say goodbye on and stop all transports */
	async stopAll(): Promise<void> {
		// Including those already stopping, which are no longer in #running, so that all have stopped when this returns
		await Promise.all([...Array.from(this.#running.keys(), async (id) => this.#stop(id)), ...this.#stopping])
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

	add(type: string, label: string): string {
		const definition = this.#definitions.get(type)
		if (!definition) throw new Error(`Unknown transport type "${type}"`)

		const sortOrder = Math.max(-1, ...Array.from(this.#configs.values(), (c) => c.sortOrder)) + 1

		const config: LinkTransportConfig = {
			id: nanoid(),
			type,
			label,
			enabled: true,
			config: getDefaultLinkTransportConfig(definition.configFields),
			sortOrder,
		}
		this.#save(config)
		this.#startStop(config)

		return config.id
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
		const existing = this.#configs.get(id)
		if (!existing) throw new Error(`Unknown transport "${id}"`)

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
		const existing = this.#configs.get(id)
		if (!existing) throw new Error(`Unknown transport "${id}"`)

		const updated: LinkTransportConfig = { ...existing, enabled }
		this.#save(updated)

		if (!enabled) await this.#stop(id)
		this.#startStop(updated)
	}

	async remove(id: string): Promise<void> {
		if (!this.#configs.has(id)) return

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

	/** Make our announcement known on every connected transport, or withdraw it (null) */
	announceAll(payload: string | null): void {
		for (const id of this.#running.keys()) this.announceOn(id, payload)
	}

	/** Make our announcement known on one transport, if it is connected, or withdraw it (null) */
	announceOn(transportId: string, payload: string | null): void {
		const running = this.#getConnected(transportId)
		if (running) this.#callTransport(transportId, () => running.transport.announce(payload))
	}

	/** Send a message to a peer over one transport, if it is connected */
	sendTo(transportId: string, peerId: string, payload: string): void {
		const running = this.#getConnected(transportId)
		if (running) this.#callTransport(transportId, () => running.transport.send(peerId, payload))
	}

	#getConnected(transportId: string): RunningTransport | null {
		const running = this.#running.get(transportId)
		return running?.state.status === 'connected' ? running : null
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
			this.#setFailed(config.id, `Unknown transport type "${config.type}"`)
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
					storage: {
						get: (key) => storageTable.get(id)?.[key],
						set: (key, value) => storageTable.set(id, { ...storageTable.get(id), [key]: value }),
					},
					receiveAnnouncement: (peerId, payload) => {
						if (running && this.#running.get(id) === running) {
							this.events.emit('announcement', id, peerId, payload)
						}
					},
					receive: (payload, origin) => {
						if (running && this.#running.get(id) === running) {
							this.events.emit('message', id, payload, origin)
						}
					},
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
			running = { transport, state }
		} catch (e) {
			logger.error(`Failed to start: ${stringifyError(e)}`)
			this.#setFailed(id, stringifyError(e))
			return
		}

		this.#running.set(id, running)

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

		const stopping = this.#destroy(id, running)
		this.#stopping.add(stopping)
		try {
			await stopping
		} finally {
			this.#stopping.delete(stopping)
		}
	}

	async #destroy(id: string, running: RunningTransport): Promise<void> {
		// Say goodbye, so that peers know we have gone rather than waiting for us to time out
		this.announceOn(id, null)

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
