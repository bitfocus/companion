import type { ActionSetsModel } from './ActionModel.js'
import type { EventInstance } from './EventModel.js'
import type { FeedbackInstance } from './FeedbackModel.js'

export interface TriggerModel {
	readonly type: 'trigger'
	options: TriggerOptions

	action_sets: ActionSetsModel
	condition: FeedbackInstance[]
	events: EventInstance[]
}

export interface TriggerOptions {
	name: string
	enabled: boolean
	sortOrder: number
	relativeDelay: boolean
}

export interface ClientTriggerData extends TriggerOptions {
	type: 'trigger'
	lastExecuted: number | undefined
	description: string
}
