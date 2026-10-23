import type {
	FeedbackValue,
	RawStoreResultCustomVariable,
	RawStoreResultLocalVariable,
	RawStoreResultPageVariable,
} from '@companion-app/shared/Model/EntityModel.js'
import type { ExpressionValueType } from '@companion-app/shared/Model/Options.js'
import type { VariableValues } from '@companion-app/shared/Model/Variables.js'
import type { InstanceDefinitions } from '../../Instance/Definitions.js'
import type { InstanceProcessManager } from '../../Instance/ProcessManager.js'
import type { InternalController } from '../../Internal/Controller.js'
import type {
	ExpressionParserOptions,
	VariablesAndExpressionParser,
} from '../../Variables/VariablesAndExpressionParser.js'
import type { EntityPoolSpecialExpressionManager } from './EntitySpecialExpressionManager.js'

export type { FeedbackExecutionContext } from '../../Internal/Types.js'

export type InstanceDefinitionsForEntity = Pick<InstanceDefinitions, 'getEntityDefinition'>

export type ProcessManagerForEntity = Pick<
	InstanceProcessManager,
	'connectionEntityUpdate' | 'connectionEntityDelete' | 'connectionEntityLearnOptions'
>

export type InternalControllerForEntity = Pick<
	InternalController,
	'entityUpdate' | 'entityDelete' | 'entityUpgrade' | 'executeLogicFeedback' | 'evaluateFeedbackValue'
>

/**
 * Where the entities of a list get their variables from. The entities of a control use the variables of that control,
 * but a list can provide a different scope for its entities, such as a run of a custom action
 */
export interface EntityScope {
	/** Tracks the expressions of the entities which are not part of their options, such as isInverted */
	readonly specialExpressionManager: EntityPoolSpecialExpressionManager
	/** Create a parser for the options of the entities */
	createVariablesAndExpressionParser(
		overrideVariableValues: VariableValues | null,
		options?: ExpressionParserOptions
	): VariablesAndExpressionParser
}

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
