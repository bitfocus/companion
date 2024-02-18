import type {
	ActionDefinitionUpdate,
	ClientActionDefinition,
} from '@companion-app/shared/Model/ActionDefinitionModel.js'
import { assertNever } from '../util.js'
import { ObservableMap, action, observable } from 'mobx'
import { ApplyDiffToStore } from './ApplyDiffToMap.js'

export type ConnectionActionDefinitions = ObservableMap<string, ClientActionDefinition>

export class ActionDefinitionsStore {
	readonly connections = observable.map<string, ConnectionActionDefinitions>()

	public reset = action(
		(newData: Record<string, Record<string, ClientActionDefinition | undefined> | undefined> | null) => {
			this.connections.clear()

			if (newData) {
				for (const [connectionId, actionSet] of Object.entries(newData)) {
					if (!actionSet) continue

					this.#replaceConnection(connectionId, actionSet)
				}
			}
		}
	)

	public applyChanges = action((change: ActionDefinitionUpdate) => {
		const changeType = change.type
		switch (change.type) {
			case 'add-connection':
				this.#replaceConnection(change.connectionId, change.actions)
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
				console.error(`Unknown action definitions change: ${changeType}`)
				assertNever(change)
				break
		}
	})

	#replaceConnection(connectionId: string, actionSet: Record<string, ClientActionDefinition | undefined>): void {
		const moduleActions = observable.map<string, ClientActionDefinition>()
		this.connections.set(connectionId, moduleActions)

		for (const [actionId, action] of Object.entries(actionSet)) {
			if (!action) continue

			moduleActions.set(actionId, action)
		}
	}
}
