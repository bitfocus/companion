import type { InstanceProcessManager } from '../../Instance/ProcessManager.js'
import type { InstanceDefinitions } from '../../Instance/Definitions.js'
import type { InternalController } from '../../Internal/Controller.js'
import type { FeedbackValue } from '@companion-app/shared/Model/EntityModel.js'

export type InstanceDefinitionsForEntity = Pick<InstanceDefinitions, 'getEntityDefinition'>

export type ProcessManagerForEntity = Pick<
	InstanceProcessManager,
	'connectionEntityUpdate' | 'connectionEntityDelete' | 'connectionEntityLearnOptions'
>

export type InternalControllerForEntity = Pick<
	InternalController,
	'entityUpdate' | 'entityDelete' | 'entityUpgrade' | 'executeLogicFeedback'
>

export interface NewFeedbackValue {
	entityId: string
	controlId: string

	value: FeedbackValue
}

export interface NewIsInvertedValue {
	entityId: string
	controlId: string
	isInverted: boolean
}
