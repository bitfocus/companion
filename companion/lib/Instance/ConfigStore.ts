import { ClientConnectionConfig } from '@companion-app/shared/Model/Connections.js'
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

export interface AddInstanceProps {
	versionId: string | null
	updatePolicy: InstanceVersionUpdatePolicy
	disabled: boolean
	collectionId?: string
	sortOrder?: number
}

export class InstanceConfigStore {
	// readonly #logger = LogController.createLogger('Instance/ConnectionConfigStore')

	readonly #dbTable: DataStoreTableView<Record<string, InstanceConfig>>
	readonly #afterSave: (instanceIds: string[], updateProcessManager: boolean) => void

	#store: Map<string, InstanceConfig>

	constructor(db: DataDatabase, afterSave: (instanceIds: string[], updateProcessManager: boolean) => void) {
		this.#dbTable = db.getTableView('connections') // TODO - rename?
		this.#afterSave = afterSave

		this.#store = new Map(Object.entries(this.#dbTable.all()))

		// Ensure all entries are defined
		for (const [id, config] of this.#store) {
			if (!config) this.#store.delete(id)
		}

		// Ensure all entries have the moduleInstanceType set
		// TODO - do properly?
		for (const instance of this.#store.values()) {
			if (!instance.moduleInstanceType) instance.moduleInstanceType = ModuleInstanceType.Connection
		}
	}

	/**
	 * Write the changes to the database, and perform any post-save hooks
	 */
	commitChanges(instanceIds: string[], updateProcessManager: boolean): void {
		for (const instanceId of instanceIds) {
			const entry = this.#store.get(instanceId)
			if (entry) {
				this.#dbTable.set(instanceId, entry)
			} else {
				this.#dbTable.delete(instanceId)
			}
		}

		this.#afterSave(instanceIds, updateProcessManager)
	}

	/**
	 * Get all connection IDs
	 */
	getAllInstanceIdsOfType(type: ModuleInstanceType | null): string[] {
		if (!type) return Array.from(this.#store.keys())

		const ids: string[] = []
		for (const [id, conf] of this.#store) {
			if (conf.moduleInstanceType === type) {
				ids.push(id)
			}
		}
		return ids
	}

	getConnectionIdFromLabel(label: string): string | undefined {
		for (const [id, conf] of this.#store) {
			if (conf && conf.moduleInstanceType === ModuleInstanceType.Connection && conf.label === label) {
				return id
			}
		}
		return undefined
	}

	getConfigOfTypeForId(instanceId: string, instanceType: ModuleInstanceType | null): InstanceConfig | undefined {
		const config = this.#store.get(instanceId)
		if (!config) return undefined

		if (instanceType && config.moduleInstanceType !== instanceType) return undefined

		return config
	}

	/**
	 * Add a new connection
	 * Note: this does not persist the changes
	 */
	addConnection(
		moduleId: string,
		label: string,
		product: string | undefined,
		props: AddInstanceProps
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
			instance_type: moduleId,
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

	/**
	 * Get all instance configurations
	 */
	getAllInstanceConfigs(): Map<string, InstanceConfig> {
		return this.#store
	}

	forgetInstance(id: string): void {
		this.#store.delete(id)

		this.commitChanges([id], true)
	}

	exportAllConnections(includeSecrets: boolean): Record<string, InstanceConfig | undefined> {
		const result: Record<string, InstanceConfig | undefined> = {}

		for (const [id, config] of this.#store) {
			if (config.moduleInstanceType === ModuleInstanceType.Connection) {
				if (includeSecrets) {
					result[id] = config
				} else {
					const newConfig = cloneDeep(config)
					delete newConfig.secrets
					result[id] = newConfig
				}
			}
		}

		return result
	}

	getPartialClientConnectionsJson(): Record<string, ClientConnectionConfig> {
		const result: Record<string, ClientConnectionConfig> = {}

		for (const [id, config] of this.#store) {
			if (config.moduleInstanceType !== ModuleInstanceType.Connection) continue

			result[id] = {
				moduleType: config.moduleInstanceType,
				moduleId: config.instance_type,
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

	getModuleVersionsMetrics(moduleType: ModuleInstanceType): Record<string, Record<string, number>> {
		const moduleVersionCounts: Record<string, Record<string, number>> = {}

		for (const moduleConfig of this.#store.values()) {
			if (
				moduleConfig.moduleInstanceType === moduleType &&
				moduleConfig.instance_type !== 'bitfocus-companion' &&
				!!moduleConfig.enabled
			) {
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
	makeLabelUnique(moduleType: ModuleInstanceType, prefix: string, ignoreId?: string): string {
		const knownLabels = new Set()
		for (const [id, obj] of this.#store) {
			if (id !== ignoreId && obj && obj.label && obj.moduleInstanceType === moduleType) {
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
		if (!thisConnection || thisConnection.moduleInstanceType !== ModuleInstanceType.Connection) return false

		const changedIds: string[] = []

		// find all the other connections with the matching collectionId
		const sortedConnectionIds = Array.from(this.#store)
			.filter(
				([id, config]) =>
					config &&
					((!config.collectionId && !collectionId) || config.collectionId === collectionId) &&
					id !== connectionId &&
					config.moduleInstanceType === ModuleInstanceType.Connection
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

		// Note: only connections have collections

		// Figure out the first sort order
		let nextSortOrder = 0
		for (const config of this.#store.values()) {
			if (config && !config?.collectionId && config.moduleInstanceType === ModuleInstanceType.Connection) {
				nextSortOrder = Math.max(nextSortOrder, config.sortOrder + 1)
			}
		}

		// Validate the collectionIds, and do something sensible with the sort order
		// Future: maybe this could try to preserve the order in some way?
		for (const [id, config] of this.#store) {
			if (
				config &&
				config.moduleInstanceType === ModuleInstanceType.Connection &&
				config.collectionId &&
				!validCollectionIds.has(config.collectionId)
			) {
				config.collectionId = undefined
				config.sortOrder = nextSortOrder++
				changedIds.push(id)
			}
		}

		this.commitChanges(changedIds, true)
	}

	findActiveUsagesOfModule(
		moduleType: ModuleInstanceType,
		moduleId: string,
		versionId?: string
	): { instanceIds: string[]; labels: string[] } {
		const instanceIds: string[] = []
		const labels: string[] = []

		for (const [id, config] of this.#store) {
			if (
				config &&
				config.moduleInstanceType === moduleType &&
				config.instance_type === moduleId &&
				config.enabled &&
				(versionId === undefined || config.moduleVersionId === versionId)
			) {
				instanceIds.push(id)
				labels.push(config.label)
			}
		}

		return { instanceIds, labels }
	}
}
