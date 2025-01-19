import {
	ConnectionConfig,
	ClientConnectionConfig,
	ConnectionUpdatePolicy,
} from '@companion-app/shared/Model/Connections.js'
import { DataDatabase } from '../Data/Database.js'
// import LogController from '../Log/Controller.js'
import { nanoid } from 'nanoid'
import { cloneDeep } from 'lodash-es'
import { makeLabelSafe } from '@companion-app/shared/Label.js'

export class ConnectionConfigStore {
	// readonly #logger = LogController.createLogger('Instance/ConnectionConfigStore')

	readonly #db: DataDatabase
	readonly #afterSave: (connectionIds: string[]) => void

	#store: Record<string, ConnectionConfig | undefined>

	constructor(db: DataDatabase, afterSave: (connectionIds: string[]) => void) {
		this.#db = db
		this.#afterSave = afterSave

		this.#store = this.#db.getKey('instance', {})
	}

	/**
	 * Write the changes to the database, and perform any post-save hooks
	 */
	commitChanges(connectionIds: string[]): void {
		this.#db.setKey('instance', this.#store)

		this.#afterSave(connectionIds)
	}

	getAllInstanceIds(): string[] {
		return Object.keys(this.#store)
	}

	getIdFromLabel(label: string): string | undefined {
		for (const [id, conf] of Object.entries(this.#store)) {
			if (conf && conf.label === label) {
				return id
			}
		}
		return undefined
	}

	getConfigForId(connectionId: string): ConnectionConfig | undefined {
		return this.#store[connectionId]
	}

	/**
	 * Add a new connection
	 * Note: this does not persist the changes
	 */
	addConnection(
		moduleType: string,
		label: string,
		product: string | undefined,
		moduleVersionId: string | null,
		updatePolicy: ConnectionUpdatePolicy,
		disabled: boolean
	): [id: string, config: ConnectionConfig] {
		// Find the highest rank given to an instance
		const highestRank =
			Math.max(
				0,
				...Object.values(this.#store)
					.map((c) => c?.sortOrder)
					.filter((n) => typeof n === 'number')
			) || 0

		const id = nanoid()

		this.#store[id] = {
			instance_type: moduleType,
			moduleVersionId: moduleVersionId,
			updatePolicy: updatePolicy,
			sortOrder: highestRank + 1,
			label: label,
			isFirstInit: true,
			config: {
				product: product,
			},
			lastUpgradeIndex: -1,
			enabled: !disabled,
		}

		return [id, this.#store[id]]
	}

	forgetConnection(id: string): void {
		delete this.#store[id]

		this.commitChanges([id])
	}

	exportAll(clone = true): Record<string, ConnectionConfig | undefined> {
		const obj = this.#store
		return clone ? cloneDeep(obj) : obj
	}

	getPartialClientJson(): Record<string, ClientConnectionConfig> {
		const result: Record<string, ClientConnectionConfig> = {}

		for (const [id, config] of Object.entries(this.#store)) {
			if (!config) continue

			result[id] = {
				instance_type: config.instance_type,
				moduleVersionId: config.moduleVersionId,
				updatePolicy: config.updatePolicy,
				label: config.label,
				enabled: config.enabled,
				sortOrder: config.sortOrder,

				// Runtime properties
				hasRecordActionsHandler: false, // Filled in later
			}
		}

		return result
	}

	getInstancesMetrics(): Record<string, number> {
		const instancesCounts: Record<string, number> = {}

		for (const instance_config of Object.values(this.#store)) {
			if (
				instance_config &&
				instance_config.instance_type !== 'bitfocus-companion' &&
				instance_config.enabled !== false
			) {
				if (instancesCounts[instance_config.instance_type]) {
					instancesCounts[instance_config.instance_type]++
				} else {
					instancesCounts[instance_config.instance_type] = 1
				}
			}
		}

		return instancesCounts
	}

	/**
	 *
	 */
	makeLabelUnique(prefix: string, ignoreId?: string): string {
		const knownLabels = new Set()
		for (const [id, obj] of Object.entries(this.#store)) {
			if (id !== ignoreId && obj && obj.label) {
				knownLabels.add(obj.label)
			}
		}

		prefix = makeLabelSafe(prefix)

		let label = prefix
		let i = 1
		while (knownLabels.has(label)) {
			// Try the next
			label = `${prefix}_${++i}`
		}

		return label
	}

	setOrder(connectionIds: string[]): void {
		// This is a bit naive, but should be sufficient if the client behaves

		// Update the order based on the ids provided
		connectionIds.forEach((id, index) => {
			const entry = this.#store[id]
			if (entry) entry.sortOrder = index
		})

		// Make sure all not provided are at the end in their original order
		const allKnownIds = Object.entries(this.#store)
			.filter((entry): entry is [string, ConnectionConfig] => entry[1] !== undefined)
			.sort(([, a], [, b]) => a.sortOrder - b.sortOrder)
			.map(([id]) => id)
		let nextIndex = connectionIds.length
		for (const id of allKnownIds) {
			if (!connectionIds.includes(id)) {
				const entry = this.#store[id]
				if (entry) entry.sortOrder = nextIndex++
			}
		}

		this.commitChanges(connectionIds)
	}

	findActiveUsagesOfModule(moduleId: string): { connectionIds: string[]; labels: string[] } {
		const connectionIds: string[] = []
		const labels: string[] = []

		for (const [id, config] of Object.entries(this.#store)) {
			if (config && config.instance_type === moduleId && config.enabled) {
				connectionIds.push(id)
				labels.push(config.label)
			}
		}

		return { connectionIds, labels }
	}
}
