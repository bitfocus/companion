import { action, observable, ObservableMap } from 'mobx'
import type {
	CompositeElementDefinition,
	CompositeElementDefinitionUpdate,
} from '../../../companion/lib/Instance/Definitions.js'
import { assertNever } from '~/Resources/util'

export class CompositeElementDefinitionsStore {
	public readonly connections = observable.map<string, ObservableMap<string, CompositeElementDefinition>>()

	public updateStore = action((change: CompositeElementDefinitionUpdate | null) => {
		if (!change) {
			this.connections.clear()
			return
		}

		const changeType = change.type
		switch (change.type) {
			case 'init':
				this.connections.clear()

				if (change.definitions) {
					for (const [connectionId, definitions] of Object.entries(change.definitions)) {
						if (!definitions) continue

						this.#replaceConnection(connectionId, definitions)
					}
				}
				break
			case 'add-connection':
				if (change.connectionId && change.entities) {
					this.#replaceConnection(change.connectionId, change.entities)
				}
				break
			case 'forget-connection':
				if (change.connectionId) {
					this.connections.delete(change.connectionId)
				}
				break
			case 'update-connection': {
				if (!change.connectionId) break

				const connection = this.connections.get(change.connectionId)
				if (!connection) break

				// Apply additions
				if (change.added) {
					for (const [elementId, definition] of Object.entries(change.added)) {
						if (definition) {
							connection.set(elementId, definition)
						}
					}
				}

				// Apply changes
				if (change.changed) {
					for (const [elementId, definition] of Object.entries(change.changed)) {
						if (definition) {
							connection.set(elementId, definition)
						}
					}
				}

				// Apply removals
				if (change.removed) {
					for (const elementId of change.removed) {
						connection.delete(elementId)
					}
				}
				break
			}
			default:
				console.error(`Unknown composite element change: ${changeType}`)
				// @ts-expect-error exhaustive check
				assertNever(change)
				break
		}
	})

	#replaceConnection(connectionId: string, definitions: Record<string, CompositeElementDefinition | undefined>): void {
		const connectionElementDefinitions = observable.map<string, CompositeElementDefinition>()
		this.connections.set(connectionId, connectionElementDefinitions)

		for (const [elementId, definition] of Object.entries(definitions)) {
			if (!definition) continue

			connectionElementDefinitions.set(elementId, definition)
		}
	}

	/**
	 * Get a composite element definition
	 */
	getDefinition(connectionId: string, elementId: string): CompositeElementDefinition | undefined {
		return this.connections.get(connectionId)?.get(elementId)
	}

	/**
	 * Get all definitions for a connection
	 */
	getConnectionDefinitions(connectionId: string): ObservableMap<string, CompositeElementDefinition> | undefined {
		return this.connections.get(connectionId)
	}
}
