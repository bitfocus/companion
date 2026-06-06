import { prepare as fuzzyPrepare } from 'fuzzysort'
import { action, observable, type ObservableMap } from 'mobx'
import { computedFn } from 'mobx-utils'
import { canAddEntityToFeedbackList } from '@companion-app/shared/Entity.js'
import type { DropdownChoice } from '@companion-app/shared/Model/Common.js'
import type {
	ClientEntityDefinition,
	EntityDefinitionUpdate,
} from '@companion-app/shared/Model/EntityDefinitionModel.js'
import { EntityModelType, FeedbackEntitySubType } from '@companion-app/shared/Model/EntityModel.js'
import { assertNever } from '~/Resources/util.js'
import { ApplyDiffToStore } from './ApplyDiffToMap.js'
import type { ConnectionsStore } from './ConnectionsStore.js'
import { RecentlyUsedIdsStore } from './RecentlyUsedIdsStore.js'

export interface AddEntityOption extends DropdownChoice {
	sortKey: string
	fuzzy: ReturnType<typeof fuzzyPrepare>
}

export interface AddEntityGroup {
	id: string
	showWhenUnfiltered: boolean
	label: string
	items: AddEntityOption[]
}

export interface EntityLeafItem {
	key: string
	fullId: string
	label: string
	searchLabel: string
	sortKey: string
	description: string | undefined
}

export class EntityDefinitionsStore {
	readonly feedbacks: EntityDefinitionsForTypeStore
	readonly actions: EntityDefinitionsForTypeStore

	readonly recentlyAddedActions: RecentlyUsedIdsStore
	readonly recentlyAddedFeedbacks: RecentlyUsedIdsStore

	constructor(connections: ConnectionsStore) {
		this.feedbacks = new EntityDefinitionsForTypeStore(EntityModelType.Feedback, connections)
		this.actions = new EntityDefinitionsForTypeStore(EntityModelType.Action, connections)

		this.recentlyAddedActions = new RecentlyUsedIdsStore('recent_actions', 20)
		this.recentlyAddedFeedbacks = new RecentlyUsedIdsStore('recent_feedbacks', 20)
	}

	getEntityDefinition(
		entityType: EntityModelType,
		connectionId: string,
		entityId: string
	): ClientEntityDefinition | undefined {
		return this.getEntityDefinitionsStore(entityType).connections.get(connectionId)?.get(entityId)
	}

	getEntityDefinitionsStore(entityType: EntityModelType): EntityDefinitionsForTypeStore {
		switch (entityType) {
			case EntityModelType.Action:
				return this.actions
			case EntityModelType.Feedback:
				return this.feedbacks
			default:
				assertNever(entityType)
				throw new Error(`Invalid entity type: ${entityType}`)
		}
	}

	getRecentlyUsedEntityDefinitionsStore(entityType: EntityModelType): RecentlyUsedIdsStore {
		switch (entityType) {
			case EntityModelType.Action:
				return this.recentlyAddedActions
			case EntityModelType.Feedback:
				return this.recentlyAddedFeedbacks
			default:
				assertNever(entityType)
				throw new Error(`Invalid entity type: ${entityType}`)
		}
	}
}

export class EntityDefinitionsForTypeStore {
	readonly connections = observable.map<string, ObservableMap<string, ClientEntityDefinition>>()

	readonly entityType: EntityModelType
	readonly #connectionsStore: ConnectionsStore

	constructor(entityType: EntityModelType, connectionsStore: ConnectionsStore) {
		this.entityType = entityType
		this.#connectionsStore = connectionsStore
	}

	#buildConnectionOptions = computedFn(
		(connectionId: string, label: string, feedbackListType: FeedbackEntitySubType | null): AddEntityOption[] => {
			const entityDefs = this.connections.get(connectionId)
			if (!entityDefs) return []

			const options: AddEntityOption[] = []
			for (const [definitionId, definition] of entityDefs.entries()) {
				if (!canAddEntityToFeedbackList(feedbackListType, definition)) continue

				const optionLabel = `${label}: ${definition.label}`
				options.push({
					id: `${connectionId}:${definitionId}`,
					label: optionLabel,
					sortKey: String(definition.sortKey ?? definition.label),
					fuzzy: fuzzyPrepare(optionLabel),
				})
			}
			options.sort((a, b) => a.sortKey.localeCompare(b.sortKey, undefined, { sensitivity: 'base' }))
			return options
		}
	)

	#buildInternalCommonOptions = computedFn((feedbackListType: FeedbackEntitySubType | null): AddEntityOption[] => {
		if (feedbackListType !== FeedbackEntitySubType.Value) return []

		const internalDefs = this.connections.get('internal')
		if (!internalDefs) return []

		const options: AddEntityOption[] = []
		for (const [definitionId, definition] of internalDefs.entries()) {
			if (
				!canAddEntityToFeedbackList(feedbackListType, definition) ||
				definition.feedbackType !== FeedbackEntitySubType.Value
			)
				continue

			const optionLabel = `internal: ${definition.label}`
			options.push({
				id: `internal:${definitionId}`,
				label: optionLabel,
				sortKey: definition.sortKey ?? definition.label,
				fuzzy: fuzzyPrepare(optionLabel),
			})
		}
		return options
	})

	buildConnectionLeaves = computedFn(
		(connectionId: string, feedbackListType: FeedbackEntitySubType | null): EntityLeafItem[] => {
			const items = this.connections.get(connectionId)
			if (!items || items.size === 0) return []

			const label = this.#connectionsStore.getLabel(connectionId) || connectionId

			const leaves: EntityLeafItem[] = []
			for (const [id, info] of items.entries()) {
				if (!info || !info.label) continue
				if (!canAddEntityToFeedbackList(feedbackListType, info)) continue

				leaves.push({
					key: `${connectionId}:${id}`,
					fullId: `${connectionId}:${id}`,
					label: info.label,
					searchLabel: `${label}: ${info.label}`,
					sortKey: String(info.sortKey ?? info.label),
					description: info.description,
				})
			}

			leaves.sort((a, b) => a.sortKey.localeCompare(b.sortKey, undefined, { sensitivity: 'base' }))
			return leaves
		}
	)

	buildBaseOptions = computedFn((feedbackListType: FeedbackEntitySubType | null): AddEntityGroup[] => {
		const allConnectionOptions: AddEntityOption[] = [
			...this.#buildConnectionOptions('internal', 'internal', feedbackListType),
		]
		for (const connection of this.#connectionsStore.sortedConnections()) {
			allConnectionOptions.push(...this.#buildConnectionOptions(connection.id, connection.label, feedbackListType))
		}

		const groups: AddEntityGroup[] = [
			{ id: '__all__', label: '', showWhenUnfiltered: false, items: allConnectionOptions },
		]

		const commonOptions = this.#buildInternalCommonOptions(feedbackListType)
		if (commonOptions.length > 0) {
			groups.push({ id: '__common__', label: 'Common', showWhenUnfiltered: true, items: commonOptions })
		}

		return groups
	})

	public updateStore = action((change: EntityDefinitionUpdate | null) => {
		if (!change) {
			this.connections.clear()
			return
		}

		const changeType = change.type
		switch (change.type) {
			case 'init':
				this.connections.clear()

				for (const [connectionId, entitySet] of Object.entries(change.definitions)) {
					if (!entitySet) continue

					this.#replaceConnection(connectionId, entitySet)
				}
				break
			case 'add-connection':
				this.#replaceConnection(change.connectionId, change.entities)
				break
			case 'forget-connection':
				this.connections.delete(change.connectionId)
				break
			case 'update-connection': {
				const connection = this.connections.get(change.connectionId)
				if (!connection) throw new Error(`Got update for unknown connection: ${change.connectionId}`)

				ApplyDiffToStore(connection, change)
				break
			}

			default:
				console.error(`Unknown entity definitions change: ${changeType}`)
				assertNever(change)
				break
		}
	})

	#replaceConnection(connectionId: string, entitySet: Record<string, ClientEntityDefinition | undefined>): void {
		const connectionEntityDefinitions = observable.map<string, ClientEntityDefinition>()
		this.connections.set(connectionId, connectionEntityDefinitions)

		for (const [entityId, entity] of Object.entries(entitySet)) {
			if (!entity) continue

			connectionEntityDefinitions.set(entityId, entity)
		}
	}
}
