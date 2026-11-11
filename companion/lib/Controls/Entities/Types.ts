import type { SomeControlId } from '@companion-app/shared/ControlId.js'
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
import type { CustomActionInstancesForEntity } from '../CustomActions/CustomActionInstanceManager.js'
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
	/**
	 * The control ids of the custom actions the entities are running inside, outermost first.
	 * Empty for the entities of an ordinary control
	 */
	readonly customActionChain: ReadonlyArray<string>
	/** Builds the copy of a custom action held by an action which calls it */
	readonly customActionInstances: CustomActionInstancesForEntity
	/**
	 * Whether the entities are copies which exist only while running, such as of a custom action. They are rebuilt
	 * from what they copy when it changes, so are never upgraded or saved themselves
	 */
	readonly isTransient: boolean
	/**
	 * Some local variables among the entities have changed value. A control reports its own local variables itself, so
	 * only a copy, whose values are its own, needs to do anything
	 * @param names The names of the variables, with their `local:` prefix
	 */
	localVariablesChanged(names: ReadonlySet<string>): void
	/** Create a parser for the options of the entities */
	createVariablesAndExpressionParser(
		overrideVariableValues: VariableValues | null,
		options?: ExpressionParserOptions
	): VariablesAndExpressionParser
}

export interface NewFeedbackValue {
	entityId: string
	controlId: SomeControlId

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
