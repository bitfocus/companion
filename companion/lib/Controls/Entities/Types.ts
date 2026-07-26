import type {
	FeedbackValue,
	RawStoreResultCustomVariable,
	RawStoreResultLocalVariable,
	RawStoreResultPageVariable,
} from '@companion-app/shared/Model/EntityModel.js'
import type { ExpressionValueType } from '@companion-app/shared/Model/Options.js'
import type { InstanceDefinitions } from '../../Instance/Definitions.js'
import type { InstanceProcessManager } from '../../Instance/ProcessManager.js'
import type { InternalController } from '../../Internal/Controller.js'

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

type StoreResultInLocalVariable = {
	type: RawStoreResultLocalVariable['type']
	location: ExpressionValueType<RawStoreResultLocalVariable['location']>
	variableName: ExpressionValueType<RawStoreResultLocalVariable['variableName']>
}

type StoreResultInPageVariable = {
	type: RawStoreResultPageVariable['type']
	page: ExpressionValueType<RawStoreResultPageVariable['page']>
	variableName: ExpressionValueType<RawStoreResultPageVariable['variableName']>
}

type StoreResultInCustomVariable = {
	type: RawStoreResultCustomVariable['type']
	variableName: ExpressionValueType<RawStoreResultCustomVariable['variableName']>
	createIfNotExists: RawStoreResultCustomVariable['createIfNotExists']
}

export type StoreResult = StoreResultInLocalVariable | StoreResultInPageVariable | StoreResultInCustomVariable
