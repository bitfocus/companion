import type {
	FeedbackDefinitionUpdate,
	InternalFeedbackDefinition,
} from '@companion-app/shared/Model/FeedbackDefinitionModel.js'
import { ObservableMap, action, observable } from 'mobx'
import { ApplyDiffToStore } from './ApplyDiffToMap.js'
import { assertNever } from '../util.js'

export type ConnectionFeedbackDefinitions = ObservableMap<string, InternalFeedbackDefinition>

export class FeedbackDefinitionsStore {
	readonly connections = observable.map<string, ConnectionFeedbackDefinitions>()

	public reset = action(
		(newData: Record<string, Record<string, InternalFeedbackDefinition | undefined> | undefined> | null) => {
			this.connections.clear()

			if (newData) {
				for (const [connectionId, feedbackSet] of Object.entries(newData)) {
					if (!feedbackSet) continue

					this.#replaceConnection(connectionId, feedbackSet)
				}
			}
		}
	)

	public applyChanges = action((change: FeedbackDefinitionUpdate) => {
		const changeType = change.type
		switch (change.type) {
			case 'add-connection':
				this.#replaceConnection(change.connectionId, change.feedbacks)
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
				console.error(`Unknown feedback definitions change: ${changeType}`)
				assertNever(change)
				break
		}
	})

	#replaceConnection(connectionId: string, feedbackSet: Record<string, InternalFeedbackDefinition | undefined>): void {
		const moduleFeedbacks = observable.map<string, InternalFeedbackDefinition>()
		this.connections.set(connectionId, moduleFeedbacks)

		for (const [feedbackId, feedback] of Object.entries(feedbackSet)) {
			if (!feedback) continue

			moduleFeedbacks.set(feedbackId, feedback)
		}
	}
}
