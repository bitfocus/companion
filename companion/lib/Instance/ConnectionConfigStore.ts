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
import { DataStoreTableView } from '../Data/StoreBase.js'

export class ConnectionConfigStore {
	// readonly #logger = LogController.createLogger('Instance/ConnectionConfigStore')

	readonly #dbTable: DataStoreTableView<Record<string, ConnectionConfig>>
	readonly #afterSave: (connectionIds: string[]) => void

	#store: Map<string, ConnectionConfig>

	constructor(db: DataDatabase, afterSave: (connectionIds: string[]) => void) {
		this.#dbTable = db.getTableView('connections')
		this.#afterSave = afterSave

		this.#store = new Map(Object.entries(this.#dbTable.all()))
	}

	/**
	 * Write the changes to the database, and perform any post-save hooks
	 */
	commitChanges(connectionIds: string[]): void {
		for (const connectionId of connectionIds) {
			const entry = this.#store.get(connectionId)
			if (entry) {
				this.#dbTable.set(connectionId, entry)
			} else {
				this.#dbTable.delete(connectionId)
			}
		}

		this.#afterSave(connectionIds)
	}

	getAllInstanceIds(): string[] {
		return Array.from(this.#store.keys())
	}

	getIdFromLabel(label: string): string | undefined {
		for (const [id, conf] of this.#store) {
			if (conf && conf.label === label) {
				return id
			}
		}
		return undefined
	}

	getConfigForId(connectionId: string): ConnectionConfig | undefined {
		return this.#store.get(connectionId)
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
				...Array.from(this.#store.values())
					.map((c) => c?.sortOrder)
					.filter((n) => typeof n === 'number')
			) || 0

		const id = nanoid()

		const newConfig: ConnectionConfig = {
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

		this.#store.set(id, newConfig)

		return [id, newConfig]
	}

	forgetConnection(id: string): void {
		this.#store.delete(id)

		this.commitChanges([id])
	}

	exportAll(clone = true): Record<string, ConnectionConfig | undefined> {
		const obj = Object.fromEntries(this.#store.entries())
		return clone ? cloneDeep(obj) : obj
	}

	getPartialClientJson(): Record<string, ClientConnectionConfig> {
		const result: Record<string, ClientConnectionConfig> = {}

		for (const [id, config] of this.#store) {
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

	getModuleVersionsMetrics(): Record<string, Record<string, number>> {
		const moduleVersionCounts: Record<string, Record<string, number>> = {}

		for (const moduleConfig of this.#store.values()) {
			if (moduleConfig && moduleConfig.instance_type !== 'bitfocus-companion' && !!moduleConfig.enabled) {
				const moduleId = moduleConfig.instance_type
				const versionId = moduleConfig.moduleVersionId ?? ''

				if (moduleVersionCounts[moduleId]?.[versionId]) {
					moduleVersionCounts[moduleId][versionId]++
				} else if (moduleVersionCounts[moduleId]) {
					moduleVersionCounts[moduleId][versionId] = 1
				} else {
					moduleVersionCounts[moduleId] = { [versionId]: 1 }
				}
			}
		}

		return moduleVersionCounts
	}

	/**
	 *
	 */
	makeLabelUnique(prefix: string, ignoreId?: string): string {
		const knownLabels = new Set()
		for (const [id, obj] of this.#store) {
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
			const entry = this.#store.get(id)
			if (entry) entry.sortOrder = index
		})

		// Make sure all not provided are at the end in their original order
		const allKnownIds = Array.from(this.#store)
			.sort(([, a], [, b]) => a.sortOrder - b.sortOrder)
			.map(([id]) => id)
		let nextIndex = connectionIds.length
		for (const id of allKnownIds) {
			if (!connectionIds.includes(id)) {
				const entry = this.#store.get(id)
				if (entry) entry.sortOrder = nextIndex++
			}
		}

		this.commitChanges(connectionIds)
	}

	findActiveUsagesOfModule(moduleId: string): { connectionIds: string[]; labels: string[] } {
		const connectionIds: string[] = []
		const labels: string[] = []

		for (const [id, config] of this.#store) {
			if (config && config.instance_type === moduleId && config.enabled) {
				connectionIds.push(id)
				labels.push(config.label)
			}
		}

		return { connectionIds, labels }
	}
}
