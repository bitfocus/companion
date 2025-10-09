import type { InstanceProcessManager } from '../../Instance/ProcessManager.js'
import type { InstanceDefinitions } from '../../Instance/Definitions.js'
import { InternalController } from '../../Internal/Controller.js'

export type InstanceDefinitionsForEntity = Pick<InstanceDefinitions, 'getEntityDefinition'>

export type ProcessManagerForEntity = Pick<
	InstanceProcessManager,
	'connectionEntityUpdate' | 'connectionEntityDelete' | 'connectionEntityLearnOptions'
>

export type InternalControllerForEntity = Pick<
	InternalController,
	'entityUpdate' | 'entityDelete' | 'entityUpgrade' | 'executeLogicFeedback'
>
