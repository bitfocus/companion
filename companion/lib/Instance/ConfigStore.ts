import type { ClientConnectionConfig } from '@companion-app/shared/Model/Connections.js'
import {
	InstanceConfig,
	InstanceVersionUpdatePolicy,
	ModuleInstanceType,
} from '@companion-app/shared/Model/Instance.js'
import { DataDatabase } from '../Data/Database.js'
// import LogController from '../Log/Controller.js'
import { nanoid } from 'nanoid'
import { makeLabelSafe } from '@companion-app/shared/Label.js'
import { DataStoreTableView } from '../Data/StoreBase.js'
import { cloneDeep } from 'lodash-es'

export interface AddConnectionProps {
	versionId: string | null
	updatePolicy: InstanceVersionUpdatePolicy
	disabled: boolean
	collectionId?: string
	sortOrder?: number
}

export class InstanceConfigStore {
	// readonly #logger = LogController.createLogger('Instance/InstanceConfigStore')

	readonly #dbTable: DataStoreTableView<Record<string, InstanceConfig>>
	readonly #afterSave: (connectionIds: string[], updateConnectionHost: boolean) => void

	#store: Map<string, InstanceConfig>

	constructor(db: DataDatabase, afterSave: (connectionIds: string[], updateConnectionHost: boolean) => void) {
		this.#dbTable = db.getTableView('connections')
		this.#afterSave = afterSave

		this.#store = new Map(Object.entries(this.#dbTable.all()))
	}

	/**
	 * Write the changes to the database, and perform any post-save hooks
	 */
	commitChanges(connectionIds: string[], updateConnectionHost: boolean): void {
		for (const connectionId of connectionIds) {
			const entry = this.#store.get(connectionId)
			if (entry) {
				this.#dbTable.set(connectionId, entry)
			} else {
				this.#dbTable.delete(connectionId)
			}
		}

		this.#afterSave(connectionIds, updateConnectionHost)
	}

	getInstanceIdsForAllTypes(): string[] {
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

	getConfigOfTypeForId(connectionId: string, _instanceType: ModuleInstanceType | null): InstanceConfig | undefined {
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
		props: AddConnectionProps
	): [id: string, config: InstanceConfig] {
		// Find the highest rank given to an instance
		const highestRank =
			Math.max(
				0,
				...Array.from(this.#store.values())
					.map((c) => c?.sortOrder)
					.filter((n) => typeof n === 'number')
			) || 0

		const id = nanoid()

		// const collectionIdIsValid = this.#store

		const newConfig: InstanceConfig = {
			moduleInstanceType: ModuleInstanceType.Connection,
			instance_type: moduleType,
			moduleVersionId: props.versionId,
			updatePolicy: props.updatePolicy,
			sortOrder: props.sortOrder ?? highestRank + 1,
			collectionId: props.collectionId ?? undefined,
			label: label,
			isFirstInit: true,
			config: {
				product: product,
			},
			secrets: {},
			lastUpgradeIndex: -1,
			enabled: !props.disabled,
		}

		this.#store.set(id, newConfig)

		return [id, newConfig]
	}

	forgetConnection(id: string): void {
		this.#store.delete(id)

		this.commitChanges([id], true)
	}

	exportAll(includeSecrets: boolean): Record<string, InstanceConfig | undefined> {
		const obj = Object.fromEntries(this.#store.entries())
		if (includeSecrets) return obj

		const newObj = cloneDeep(obj)
		for (const config of Object.values(newObj)) {
			delete config.secrets
		}
		return newObj
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
				collectionId: config.collectionId ?? null,

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

	moveConnection(collectionId: string | null, connectionId: string, dropIndex: number): boolean {
		const thisConnection = this.#store.get(connectionId)
		if (!thisConnection) return false

		const changedIds: string[] = []

		// find all the other connections with the matching collectionId
		const sortedConnectionIds = Array.from(this.#store)
			.filter(
				([id, config]) =>
					config &&
					((!config.collectionId && !collectionId) || config.collectionId === collectionId) &&
					id !== connectionId
			)
			.sort(([, a], [, b]) => (a?.sortOrder || 0) - (b?.sortOrder || 0))
			.map(([id]) => id)

		if (dropIndex < 0) {
			// Push the connection to the end of the array
			sortedConnectionIds.push(connectionId)
		} else {
			// Insert the connection at the drop index
			sortedConnectionIds.splice(dropIndex, 0, connectionId)
		}

		// update the sort order of the connections in the store, tracking which ones changed
		sortedConnectionIds.forEach((id, index) => {
			const entry = this.#store.get(id)
			if (entry && entry.sortOrder !== index) {
				entry.sortOrder = index
				changedIds.push(id)
			}
		})

		// Also update the collectionId of the connection being moved if needed
		if (thisConnection.collectionId !== collectionId) {
			thisConnection.collectionId = collectionId ?? undefined
			if (!changedIds.includes(connectionId)) {
				changedIds.push(connectionId)
			}
		}

		// persist the changes
		if (changedIds.length > 0) {
			this.commitChanges(changedIds, true)
		}

		return true
	}

	cleanUnknownCollectionIds(validCollectionIds: Set<string>): void {
		const changedIds: string[] = []

		// Figure out the first sort order
		let nextSortOrder = 0
		for (const config of this.#store.values()) {
			if (config && !config?.collectionId) {
				nextSortOrder = Math.max(nextSortOrder, config.sortOrder + 1)
			}
		}

		// Validate the collectionIds, and do something sensible with the sort order
		// Future: maybe this could try to preserve the order in some way?
		for (const [id, config] of this.#store) {
			if (config && config.collectionId && !validCollectionIds.has(config.collectionId)) {
				config.collectionId = undefined
				config.sortOrder = nextSortOrder++
				changedIds.push(id)
			}
		}

		this.commitChanges(changedIds, true)
	}

	findActiveUsagesOfModule(moduleId: string, versionId?: string): { connectionIds: string[]; labels: string[] } {
		const connectionIds: string[] = []
		const labels: string[] = []

		for (const [id, config] of this.#store) {
			if (
				config &&
				config.instance_type === moduleId &&
				config.enabled &&
				(versionId === undefined || config.moduleVersionId === versionId)
			) {
				connectionIds.push(id)
				labels.push(config.label)
			}
		}

		return { connectionIds, labels }
	}
}
