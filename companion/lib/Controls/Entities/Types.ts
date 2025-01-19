import type { ModuleHost } from '../../Instance/Host.js'
import type { InstanceDefinitions } from '../../Instance/Definitions.js'
import { InternalController } from '../../Internal/Controller.js'

export type InstanceDefinitionsForEntity = Pick<InstanceDefinitions, 'getEntityDefinition'>

export type ModuleHostForEntity = Pick<
	ModuleHost,
	'connectionEntityUpdate' | 'connectionEntityDelete' | 'connectionEntityLearnOptions'
>

export type InternalControllerForEntity = Pick<
	InternalController,
	'entityUpdate' | 'entityDelete' | 'entityUpgrade' | 'executeLogicFeedback'
>
