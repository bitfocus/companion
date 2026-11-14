import type { CustomFeedbackControlId, SomeControlId } from '@companion-app/shared/ControlId.js'
import { EntityModelType, FeedbackEntitySubType } from '@companion-app/shared/Model/EntityModel.js'
import type { VariableValue, VariableValues } from '@companion-app/shared/Model/Variables.js'
import type { VariableDependencyRegistry } from '../../Variables/DependencyRegistry.js'
import type { ControlCustomFeedback } from '../ControlTypes/CustomFeedback.js'
import type { CustomActionInstancesForEntity } from '../CustomActions/CustomActionInstanceManager.js'
import { CustomEntityCopy } from '../CustomEntities/CustomEntityCopy.js'
import type { ControlEntityInstance } from '../Entities/EntityInstance.js'
import type { ControlEntityList } from '../Entities/EntityList.js'
import type { RenderClock } from '../RenderClock.js'
import type { CustomFeedbackInstancesForEntity } from './CustomFeedbackInstanceManager.js'

/**
 * The values seen by the entities of a copy of a custom feedback
 */
export interface CustomFeedbackValues {
	/** The control id of the custom feedback */
	readonly customFeedbackControlId: CustomFeedbackControlId
	/** The values of the inputs, exposed to the entities as `$(options:<id>)` */
	readonly inputValues: VariableValues
	/**
	 * The values of the local variables which have been set, by name (without the `local:` prefix). Nothing sets the
	 * variables of a custom feedback, so this is always empty, and each has its startup value or that of its feedback
	 */
	readonly localValues: ReadonlyMap<string, VariableValue>
}

/**
 * A copy of the feedbacks and local variables of a custom feedback, held by a feedback which uses it.
 */
export class CustomFeedbackCopy extends CustomEntityCopy<CustomFeedbackValues> {
	get feedbacks(): ControlEntityList {
		return this.entities
	}

	/**
	 * @param customFeedback The custom feedback this is a copy of
	 * @param caller The feedback which holds the copy
	 * @param callerControlId The control which holds the copy
	 * @param idPrefix The prefix for the ids of the copied entities, which must be unique within the control
	 * @param customActionChain The custom actions and feedbacks this copy is inside, ending with this one
	 * @param customActionInstances For any copies of custom actions inside this copy
	 * @param customFeedbackInstances For any copies of custom feedbacks used by this copy
	 * @param renderClock The render clock, for special expressions which depend on it
	 * @param variableDependencies Where the special expressions register the variables they reference
	 * @param values The inputs of the copy
	 * @param onValuesChanged Called when the value or isInverted value of any entity of the copy changes
	 */
	constructor(
		customFeedback: ControlCustomFeedback,
		caller: ControlEntityInstance,
		callerControlId: SomeControlId,
		idPrefix: string,
		customActionChain: ReadonlyArray<string>,
		customActionInstances: CustomActionInstancesForEntity,
		customFeedbackInstances: CustomFeedbackInstancesForEntity,
		renderClock: RenderClock,
		variableDependencies: VariableDependencyRegistry,
		values: CustomFeedbackValues,
		onValuesChanged: () => void
	) {
		super(
			{
				listName: 'feedbacks',
				listDefinition: { type: EntityModelType.Feedback, feedbackListType: FeedbackEntitySubType.Boolean },
				localVariables: customFeedback.entities.getLocalVariableEntities().map((entity) => entity.asEntityModel(true)),
				entities: customFeedback.entities.getFeedbackEntities().map((entity) => entity.asEntityModel(true)),
				createParser: (values, localVariableEntities, overrideVariableValues, options) =>
					customFeedback.createCopyParser(
						values,
						localVariableEntities,
						callerControlId,
						overrideVariableValues,
						options
					),
			},
			caller,
			callerControlId,
			idPrefix,
			customActionChain,
			customActionInstances,
			customFeedbackInstances,
			renderClock,
			variableDependencies,
			values,
			onValuesChanged
		)
	}
}
