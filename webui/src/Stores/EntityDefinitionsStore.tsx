import type {
	ClientEntityDefinition,
	EntityDefinitionUpdate,
} from '@companion-app/shared/Model/EntityDefinitionModel.js'
import { ObservableMap, action, observable } from 'mobx'
import { ApplyDiffToStore } from './ApplyDiffToMap.js'
import { assertNever } from '../util.js'
import { EntityModelType } from '@companion-app/shared/Model/EntityModel.js'

export class EntityDefinitionsStore {
	readonly feedbacks: EntityDefinitionsForTypeStore
	readonly actions: EntityDefinitionsForTypeStore

	constructor() {
		this.feedbacks = new EntityDefinitionsForTypeStore()
		this.actions = new EntityDefinitionsForTypeStore()
	}

	getEntityDefinition(
		entityType: EntityModelType,
		connectionId: string,
		entityId: string
	): ClientEntityDefinition | undefined {
		const entityDefinitions = entityType === EntityModelType.Action ? this.actions : this.feedbacks
		return entityDefinitions.connections.get(connectionId)?.get(entityId)
	}
}

export class EntityDefinitionsForTypeStore {
	readonly connections = observable.map<string, ObservableMap<string, ClientEntityDefinition>>()

	public reset = action(
		(newData: Record<string, Record<string, ClientEntityDefinition | undefined> | undefined> | null) => {
			this.connections.clear()

			if (newData) {
				for (const [connectionId, entitySet] of Object.entries(newData)) {
					if (!entitySet) continue

					this.#replaceConnection(connectionId, entitySet)
				}
			}
		}
	)

	public applyChanges = action((change: EntityDefinitionUpdate) => {
		const changeType = change.type
		switch (change.type) {
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
