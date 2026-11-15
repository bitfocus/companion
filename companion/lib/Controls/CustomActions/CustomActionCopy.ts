import type { SomeControlId } from '@companion-app/shared/ControlId.js'
import { EntityModelType } from '@companion-app/shared/Model/EntityModel.js'
import type { VariableDependencyRegistry } from '../../Variables/DependencyRegistry.js'
import type { ControlCustomAction } from '../ControlTypes/CustomAction.js'
import type { CustomActionValues } from '../CustomActionRunFrame.js'
import { CustomEntityCopy } from '../CustomEntities/CustomEntityCopy.js'
import type { CustomFeedbackInstancesForEntity } from '../CustomFeedbacks/CustomFeedbackInstanceManager.js'
import type { ControlEntityInstance } from '../Entities/EntityInstance.js'
import type { ControlEntityList } from '../Entities/EntityList.js'
import type { RenderClock } from '../RenderClock.js'
import type { CustomActionInstancesForEntity } from './CustomActionInstanceManager.js'

/**
 * A copy of the actions and local variables of a custom action, held by an action which calls it, either while it
 * waits to be run or for one run of it.
 */
export class CustomActionCopy extends CustomEntityCopy<CustomActionValues> {
	get actions(): ControlEntityList {
		return this.entities
	}

	/**
	 * @param customAction The custom action this is a copy of
	 * @param caller The action which holds the copy
	 * @param callerControlId The control which holds the copy
	 * @param idPrefix The prefix for the ids of the copied entities, which must be unique within the control
	 * @param customActionChain The custom actions this copy is running inside, ending with this one
	 * @param customActionInstances For any copies of custom actions called by this copy
	 * @param customFeedbackInstances For any copies of custom feedbacks used by this copy
	 * @param renderClock The render clock, for special expressions which depend on it
	 * @param variableDependencies Where the special expressions register the variables they reference
	 * @param values The inputs and local variable values of the copy
	 */
	constructor(
		customAction: ControlCustomAction,
		caller: ControlEntityInstance,
		callerControlId: SomeControlId,
		idPrefix: string,
		customActionChain: ReadonlyArray<string>,
		customActionInstances: CustomActionInstancesForEntity,
		customFeedbackInstances: CustomFeedbackInstancesForEntity,
		renderClock: RenderClock,
		variableDependencies: VariableDependencyRegistry,
		values: CustomActionValues
	) {
		super(
			{
				listName: 'actions',
				listDefinition: { type: EntityModelType.Action },
				localVariables: customAction.entities.getLocalVariableEntities().map((entity) => entity.asEntityModel(true)),
				entities: customAction.entities.getActionEntities().map((entity) => entity.asEntityModel(true)),
				createParser: (values, localVariableEntities, overrideVariableValues, options) =>
					customAction.createCopyParser(
						values,
						localVariableEntities,
						callerControlId,
						null,
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
			// Its local variables are reported by their lists, and nothing else reads the values of its entities
			() => undefined
		)
	}

	/**
	 * A local variable of the copy has been set, so re-parse whatever uses it
	 * @param name The name of the variable, without the `local:` prefix
	 */
	localValueChanged(name: string): void {
		this.variablesChanged(new Set([`local:${name}`]))
	}
}
