import { action, observable, type ObservableMap } from 'mobx'
import type {
	UICompositeElementDefinition,
	CompositeElementDefinitionUpdate,
} from '@companion-app/shared/Model/EntityDefinitionModel.js'
import { assertNever } from '~/Resources/util'
import { ApplyDiffToStore } from './ApplyDiffToMap.js'

export class CompositeElementDefinitionsStore {
	public readonly connections = observable.map<string, ObservableMap<string, UICompositeElementDefinition>>()

	public updateStore = action((change: CompositeElementDefinitionUpdate | null) => {
		if (!change) {
			this.connections.clear()
			return
		}

		const changeType = change.type
		switch (change.type) {
			case 'init':
				this.connections.clear()

				for (const [connectionId, elementSet] of Object.entries(change.definitions)) {
					if (!elementSet) continue

					this.#replaceConnection(connectionId, elementSet)
				}
				break
			case 'add-connection':
				this.#replaceConnection(change.connectionId, change.definitions)
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
				console.error(`Unknown composite element definitions change: ${changeType}`)
				assertNever(change)
		}
	})

	#replaceConnection = action(
		(connectionId: string, elementSet: Record<string, UICompositeElementDefinition>): void => {
			let connection = this.connections.get(connectionId)
			if (!connection) {
				connection = observable.map()
				this.connections.set(connectionId, connection)
			} else {
				connection.clear()
			}

			for (const [elementId, definition] of Object.entries(elementSet)) {
				if (definition) {
					connection.set(elementId, definition)
				}
			}
		}
	)

	/**
	 * Get a composite element definition
	 */
	getDefinition(connectionId: string, elementId: string): UICompositeElementDefinition | undefined {
		return this.connections.get(connectionId)?.get(elementId)
	}

	/**
	 * Get all definitions for a connection
	 */
	getConnectionDefinitions(connectionId: string): ObservableMap<string, UICompositeElementDefinition> | undefined {
		return this.connections.get(connectionId)
	}
}
