import type { JsonValue } from 'type-fest'
import { validateActionSetId } from '@companion-app/shared/ControlId.js'
import type { ExecuteExpressionResult } from '@companion-app/shared/ExpressionResult.js'
import type { ActionSetId, ActionSetsModel, ActionStepOptions } from '@companion-app/shared/Model/ActionModel.js'
import type { ButtonModelBase, ButtonOptionsBase, NormalButtonSteps } from '@companion-app/shared/Model/ButtonModel.js'
import {
	EntityModelType,
	FeedbackEntitySubType,
	type SomeEntityModel,
	type SomeSocketEntityLocation,
} from '@companion-app/shared/Model/EntityModel.js'
import type { ExpressionOrValue } from '@companion-app/shared/Model/Options.js'
import { stringifyVariableValue } from '@companion-app/shared/Model/Variables.js'
import { assertNever } from '@companion-app/shared/Util.js'
import { GetLegacyStyleProperty, ParseLegacyStyle } from '../../Resources/ConvertLegacyStyleToElements.js'
import type { ControlStepsRuntimeManager } from './ControlActionSetAndStepsManager.js'
import type { ControlEntityInstance } from './EntityInstance.js'
import type { ControlEntityList } from './EntityList.js'
import { ControlEntityListPoolBase, type ControlEntityListPoolProps } from './EntityListPoolBase.js'
import { WithEntityEditing, WithStepEditing } from './EntityListPoolEditingMixin.js'
import type { NewSpecialExpressionValue } from './SpecialExpressions.js'
import type { NewFeedbackValue } from './Types.js'

interface CurrentStepFromExpression {
	type: 'expression'

	expression: string

	lastStepId: string
	lastVariables: ReadonlySet<string>
}
interface CurrentStepFromId {
	type: 'id'

	id: string
}

export interface ControlEntityListActionStep {
	readonly sets: Map<ActionSetId, ControlEntityList>
	options: ActionStepOptions
}

/**
 * The shared button entity-pool base. Owns the steps/action-sets and all runtime/read behaviour (loading,
 * step navigation, evaluation, serialization). It is abstract and does not pin the `isEditable` discriminant -
 * the read-only {@link ControlEntityListPoolButton} and the editable {@link EditableControlEntityListPoolButton}
 * extend it as siblings, each setting `isEditable`. (Sibling, not parent/child, so each can pin the literal
 * discriminant without an override conflict.)
 */
export abstract class ButtonEntityListPoolBase extends ControlEntityListPoolBase {
	/**
	 * The defaults options for a step
	 */
	static DefaultStepOptions: ActionStepOptions = {
		runWhileHeld: [], // array of set ids
	}

	readonly #feedbacks: ControlEntityList
	readonly #localVariables: ControlEntityList

	protected readonly steps = new Map<string, ControlEntityListActionStep>()

	readonly #executeExpressionInControl: (expression: string, requiredType?: string) => ExecuteExpressionResult
	protected readonly sendRuntimePropsChange: () => void

	/**
	 * The current step
	 */
	protected currentStep: CurrentStepFromExpression | CurrentStepFromId = { type: 'id', id: '0' }

	#hasRotaryActions = false

	get currentStepId(): string {
		switch (this.currentStep.type) {
			case 'id':
				return this.currentStep.id
			case 'expression':
				return this.currentStep.lastStepId
			default:
				assertNever(this.currentStep)
				throw new Error('Unsupported step mode')
		}
	}

	constructor(
		props: ControlEntityListPoolProps,
		sendRuntimePropsChange: () => void,
		executeExpressionInControl: (expression: string, requiredType?: string) => ExecuteExpressionResult,
		isLayeredButton: boolean
	) {
		super(props, isLayeredButton)

		this.#executeExpressionInControl = executeExpressionInControl
		this.sendRuntimePropsChange = sendRuntimePropsChange

		this.#feedbacks = this.createEntityList({
			type: EntityModelType.Feedback,
			feedbackListType: isLayeredButton ? FeedbackEntitySubType.StyleOverride : undefined,
		})
		this.#localVariables = this.createEntityList({
			type: EntityModelType.Feedback,
			feedbackListType: FeedbackEntitySubType.Value,
		})

		this.currentStep = { type: 'id', id: '0' }

		this.steps.set('0', this.getNewStepValue(null, null))
	}

	loadStorage(storage: ButtonModelBase, skipSubscribe: boolean, isImport: boolean): void {
		this.#feedbacks.loadStorage(storage.feedbacks || [], skipSubscribe, isImport)
		this.#localVariables.loadStorage(storage.localVariables || [], skipSubscribe, isImport)

		// Future:	cleanup the steps/sets
		this.steps.clear()

		for (const [id, stepObj] of Object.entries(storage.steps ?? {})) {
			this.steps.set(id, this.getNewStepValue(stepObj.action_sets, stepObj.options))
		}

		this.currentStep = { type: 'id', id: this.getStepIds()[0] } // TODO - other modes?
	}

	/**
	 * Get direct the feedback instances
	 */
	getFeedbackEntities(): SomeEntityModel[] {
		return this.#feedbacks.getDirectEntities().map((ent) => ent.asEntityModel(true))
	}

	/**
	 * Get direct the local variable instances
	 */
	getLocalVariableEntities(): ControlEntityInstance[] {
		return this.#localVariables.getAllEntities()
	}

	asNormalButtonSteps(): NormalButtonSteps {
		const stepsJson: NormalButtonSteps = {}
		for (const [id, step] of this.steps) {
			stepsJson[id] = {
				action_sets: this.stepAsActionSetsModel(step),
				options: step.options,
			}
		}

		return stepsJson
	}

	protected stepAsActionSetsModel(step: ControlEntityListActionStep): ActionSetsModel {
		const actionSets: ActionSetsModel = {
			down: [],
			up: [],
			rotate_left: undefined,
			rotate_right: undefined,
		}
		for (const [setId, set] of step.sets) {
			actionSets[setId] = set.getDirectEntities().map((ent) => ent.asEntityModel(true))
		}

		return actionSets
	}

	protected getEntityList(listId: SomeSocketEntityLocation): ControlEntityList | undefined {
		if (listId === 'feedbacks') return this.#feedbacks
		if (listId === 'local-variables') return this.#localVariables

		if (typeof listId === 'object' && 'setId' in listId && 'stepId' in listId) {
			return this.steps.get(listId.stepId)?.sets.get(listId.setId)
		}

		return undefined
	}

	protected getAllEntityLists(): ControlEntityList[] {
		const entityLists: ControlEntityList[] = [this.#feedbacks, this.#localVariables]

		for (const step of this.steps.values()) {
			entityLists.push(...step.sets.values())
		}

		return entityLists
	}

	getFeedbackStyleOverrides(): ReadonlyMap<string, ReadonlyMap<string, ExpressionOrValue<JsonValue | undefined>>> {
		const result = new Map<string, Map<string, ExpressionOrValue<JsonValue | undefined>>>()

		const pushOverride = (
			elementId: string,
			elementProperty: string,
			override: ExpressionOrValue<JsonValue | undefined>
		) => {
			const targetMap = result.get(elementId) ?? new Map<string, ExpressionOrValue<JsonValue | undefined>>()

			// Hack: merge imageBuffers so that they stack instead of replacing
			if (elementProperty === 'base64Image') {
				const existing = targetMap.get(elementProperty)
				if (
					existing &&
					!existing.isExpression &&
					!override.isExpression &&
					Array.isArray(existing.value) &&
					Array.isArray(override.value)
				) {
					override = {
						isExpression: false,
						value: [...existing.value, ...override.value],
					}
				}
			}

			targetMap.set(elementProperty, override)
			result.set(elementId, targetMap)
		}

		const processFeedback = (feedback: ControlEntityInstance) => {
			const overrides = feedback.styleOverrides
			if (!overrides || overrides.length === 0) return

			// Special case to flatten the 'conditionalise existing feedbacks'
			if (feedback.connectionId === 'internal' && feedback.definitionId === 'logic_conditionalise_advanced') {
				// Check if the condition (all 'children' boolean feedbacks) is true
				if (!feedback.getBooleanFeedbackValue()) return

				// Get the children to treat as overrides
				const children = feedback.getChildren('feedbacks')
				if (!children || children.getAllEntities().length === 0) return

				// Process the children as if they were overrides themselves, allowing nesting of the conditionalise feedback
				for (const childFeedback of children.getDirectEntities()) {
					processFeedback(childFeedback)
				}

				return
			}

			// Get the definition, to know how to handle it
			const entityDefinition = feedback.getEntityDefinition()
			if (!entityDefinition) return

			switch (entityDefinition.feedbackType) {
				case FeedbackEntitySubType.Boolean:
					// For boolean values, we only care about the true case
					// And the override stores the value to be applied
					if (feedback.getBooleanFeedbackValue()) {
						for (const override of overrides) {
							pushOverride(override.elementId, override.elementProperty, override.override)
						}
					}
					break
				case FeedbackEntitySubType.Advanced: {
					// For advanced feedbacks, split out the value from the feedback and inject it into the map
					const style = feedback.feedbackValue
					if (!style || typeof style !== 'object') break

					const parsedStyle = ParseLegacyStyle(style)
					for (const override of overrides) {
						const newValue = GetLegacyStyleProperty(
							parsedStyle,
							style,
							stringifyVariableValue(override.override.value) ?? '',
							override.elementProperty
						)
						if (newValue) {
							pushOverride(override.elementId, override.elementProperty, newValue)
						}
					}

					break
				}
				case FeedbackEntitySubType.Value:
					// Not compatible here
					break
				case FeedbackEntitySubType.StyleOverride:
				case null:
					// Not a real feedback
					break
				default:
					assertNever(entityDefinition.feedbackType)
					break
			}
		}

		for (const feedback of this.#feedbacks.getDirectEntities()) {
			processFeedback(feedback)
		}

		return result
	}

	getStepIds(): string[] {
		return this.steps
			.keys()
			.toArray()
			.sort((a, b) => Number(a) - Number(b))
	}

	setupRotaryActionSets(ensureCreated: boolean, skipCommit?: boolean): void {
		// Cache the value
		this.#hasRotaryActions = ensureCreated

		for (const step of this.steps.values()) {
			if (ensureCreated) {
				// ensure they exist
				if (!step.sets.has('rotate_left')) step.sets.set('rotate_left', this.createActionEntityList([], false, false))
				if (!step.sets.has('rotate_right')) step.sets.set('rotate_right', this.createActionEntityList([], false, false))
			} else {
				// remove the sets
				const rotateLeftSet = step.sets.get('rotate_left')
				const rotateRightSet = step.sets.get('rotate_right')

				if (rotateLeftSet) {
					rotateLeftSet.cleanup()
					step.sets.delete('rotate_left')
				}
				if (rotateRightSet) {
					rotateRightSet.cleanup()
					step.sets.delete('rotate_right')
				}
			}
		}

		if (!skipCommit) this.reportChange({ redraw: true })
	}

	protected createActionEntityList(
		entities: SomeEntityModel[],
		skipSubscribe: boolean,
		isCloned: boolean
	): ControlEntityList {
		const list = this.createEntityList({ type: EntityModelType.Action })
		list.loadStorage(entities, skipSubscribe, isCloned)
		return list
	}

	protected getNewStepValue(
		existingActions: ActionSetsModel | null,
		existingOptions: ActionStepOptions | null
	): ControlEntityListActionStep {
		const options = existingOptions || structuredClone(ButtonEntityListPoolBase.DefaultStepOptions)

		const downList = this.createActionEntityList(existingActions?.down || [], false, !!existingActions)
		const upList = this.createActionEntityList(existingActions?.up || [], false, !!existingActions)

		const sets = new Map<ActionSetId, ControlEntityList>()
		sets.set('down', downList)
		sets.set('up', upList)

		if (this.#hasRotaryActions) {
			sets.set('rotate_left', this.createActionEntityList(existingActions?.rotate_left || [], false, !!existingActions))
			sets.set(
				'rotate_right',
				this.createActionEntityList(existingActions?.rotate_right || [], false, !!existingActions)
			)
		}

		for (const setId in existingActions || {}) {
			const setIdNumber = validateActionSetId(setId as ActionSetId)
			if (typeof setIdNumber === 'number') {
				sets.set(
					setIdNumber,
					this.createActionEntityList(existingActions?.[setIdNumber] || [], false, !!existingActions)
				)
			}
		}

		return {
			sets: sets,
			options: options,
		}
	}

	/**
	 * Get the index of the current (next to execute) step
	 * @returns The index of current step
	 */
	getActiveStepIndex(): number {
		const out = this.getStepIds().indexOf(this.currentStepId)
		return out !== -1 ? out : 0
	}

	/**
	 * Update the storeResult values on the control with new calculated
	 * storeResult values
	 * @param newValues The new storeResult values
	 */
	override updateStoreResultValues(newValues: ReadonlyMap<string, NewSpecialExpressionValue<'storeResult'>>): void {
		for (const step of this.steps.values()) {
			for (const set of step.sets.values()) {
				set.updateStoreResultValues(newValues)
			}
		}
	}

	/**
	 * Propagate variable changes
	 */
	onVariablesChanged(changedVariables: ReadonlySet<string>): void {
		super.onVariablesChanged(changedVariables)

		if (this.currentStep.type !== 'expression') return

		if (this.currentStep.lastVariables.isDisjointFrom(changedVariables)) return

		if (this.stepCheckExpression(true)) {
			// Something changed, so redraw
			this.reportChange({ redraw: true })
		}
	}

	/**
	 * Re-execute the expression, and update the current step if it has changed
	 * @param updateClient Whether to inform the client if the step changed
	 * @returns Whether a change was made
	 */
	protected stepCheckExpression(updateClient: boolean): boolean {
		if (this.currentStep.type !== 'expression') return false

		let changed = false

		const stepIds = this.getStepIds()

		const latestValue = this.#executeExpressionInControl(this.currentStep.expression, 'number')
		if (latestValue.ok) {
			let latestIndex = Math.max(Math.min(Number(latestValue.value) - 1, stepIds.length - 1), 0)
			if (isNaN(latestIndex)) latestIndex = 0

			const newStepId = stepIds[latestIndex]

			// Check if this will change the expected state
			changed = this.currentStep.lastStepId !== newStepId

			// Update the state
			this.currentStep.lastStepId = newStepId
			this.currentStep.lastVariables = latestValue.variableIds
		} else {
			// Lets always go to the first step, to ensure we have a sane and predictable value

			this.logger.warn(`Step expression failed to evaluate: ${latestValue.error}`)

			const firstStepId = stepIds[0]

			// Check if this will change the expected state
			changed = this.currentStep.lastStepId !== firstStepId

			// Update the state
			this.currentStep.lastStepId = firstStepId
			this.currentStep.lastVariables = latestValue.variableIds
		}

		// Inform clients of the change
		if (changed && updateClient) this.sendRuntimePropsChange()

		return changed
	}

	/**
	 * Update the step operation mode or expression upon button options change
	 * @param options
	 */
	stepExpressionUpdate(options: ButtonOptionsBase): void {
		if (options.stepProgression === 'expression') {
			// It may have changed, assume it has and purge the existing state
			if (this.currentStep.type !== 'expression') {
				this.currentStep = {
					type: 'expression',
					expression: options.stepExpression || '',
					lastStepId: this.getStepIds()[0],
					lastVariables: new Set(),
				}
			} else {
				this.currentStep.expression = options.stepExpression || ''
			}

			this.stepCheckExpression(true)
		} else {
			if (this.currentStep.type === 'expression') {
				// Stick to whatever is currently selected
				this.currentStep = { type: 'id', id: this.currentStepId }
			}
		}
	}

	/**
	 * Progress through the action-sets
	 * @param amount Number of steps to progress
	 */
	stepAdvanceDelta(amount: number): boolean {
		// If using an expression, don't allow manual progression
		if (this.currentStep.type !== 'id') return false

		if (amount && typeof amount === 'number') {
			const all_steps = this.getStepIds()
			if (all_steps.length > 0) {
				const current = all_steps.indexOf(this.currentStep.id)

				let newIndex = (current === -1 ? 0 : current) + amount
				while (newIndex < 0) newIndex += all_steps.length
				newIndex = newIndex % all_steps.length

				const newStepId = all_steps[newIndex]
				return this.stepSelectCurrent(newStepId)
			}
		}

		return false
	}

	/**
	 * Set the current (next to execute) action-set by index
	 * @param index The step index to make the next
	 */
	stepMakeCurrent(index: number): boolean {
		// If using an expression, don't allow manual progression
		if (this.currentStep.type !== 'id') return false

		if (typeof index === 'number') {
			const stepId = this.getStepIds()[index - 1]
			if (stepId !== undefined) {
				return this.stepSelectCurrent(stepId)
			}
		}

		return false
	}

	/**
	 * Set the current (next to execute) action-set by id
	 * @param stepId The step id to make the next
	 */
	stepSelectCurrent(stepId: string): boolean {
		// If using an expression, don't allow manual progression
		if (this.currentStep.type !== 'id') return false

		const step = this.steps.get(stepId)
		if (!step) return false

		// Ensure it isn't currently pressed
		// this.setPushed(false)

		this.currentStep.id = stepId

		this.sendRuntimePropsChange()

		this.reportChange({
			redraw: true,
			noSave: true,
		})

		return true
	}

	validateCurrentStepIdAndGetNextProgression(): [string | null, string | null] {
		if (this.currentStep.type === 'expression') {
			// When in the expression mode, the next step is unknown, but we can produce a sane current step id

			if (this.stepCheckExpression(true)) {
				// Something changed, so redraw
				this.reportChange({
					redraw: true,
					noSave: true,
				})
			}

			return [this.currentStep.lastStepId, null]
		}

		const stepIds = this.getStepIds()

		// For the automatic/manual progression
		const this_step_raw = this.currentStep.id
		if (stepIds.length > 0) {
			// verify 'this_step_raw' is valid, falling back to the first step if it is not
			// (findIndex returns -1 when not found, and -1 is truthy, so `|| 0` would not catch it)
			const foundIndex = stepIds.findIndex((s) => s == this_step_raw)
			const this_step_index = foundIndex === -1 ? 0 : foundIndex
			const this_step_id = stepIds[this_step_index]

			// figure out the new step
			const next_index = this_step_index + 1 >= stepIds.length ? 0 : this_step_index + 1
			const next_step_id = stepIds[next_index]

			return [this_step_id, next_step_id]
		} else {
			return [null, null]
		}
	}

	getActionsToExecuteForSet(setId: ActionSetId): ControlEntityInstance[] {
		const [this_step_id] = this.validateCurrentStepIdAndGetNextProgression()
		if (!this_step_id) return []

		const step = this.steps.get(this_step_id)
		if (!step) return []

		const set = step.sets.get(setId)
		if (!set) return []

		return set.getDirectEntities()
	}

	getStepActions(stepId: string):
		| {
				sets: Map<ActionSetId, ControlEntityInstance[]>
				options: Readonly<ActionStepOptions>
		  }
		| undefined {
		const step = this.steps.get(stepId)
		if (!step) return undefined

		const sets: Map<ActionSetId, ControlEntityInstance[]> = new Map()
		for (const [setId, set] of step.sets) {
			sets.set(setId, set.getDirectEntities())
		}

		return {
			sets: sets,
			options: step.options,
		}
	}

	/**
	 * Update the feedbacks on the button with new values
	 * @param connectionId The instance the feedbacks are for
	 * @param newValues The new feedback values
	 */
	updateFeedbackValues(connectionId: string, newValues: ReadonlyMap<string, NewFeedbackValue>): void {
		for (const step of this.steps.values()) {
			for (const set of step.sets.values()) {
				set.updateFeedbackValues(connectionId, newValues)
			}
		}

		const changedVariableEntities = this.#localVariables.updateFeedbackValues(connectionId, newValues)

		const changedFeedbackEntities = this.#feedbacks.updateFeedbackValues(connectionId, newValues)
		this.#emitFeedbackValueChangesForEntities(changedFeedbackEntities)

		this.tryTriggerLocalVariablesChanged(...changedVariableEntities)
	}

	/**
	 * Update the isInverted values on the control with new calculated isInverted values
	 * @param newValues The new isInverted values
	 */
	override updateIsInvertedValues(newValues: ReadonlyMap<string, NewSpecialExpressionValue<'isInverted'>>): void {
		for (const step of this.steps.values()) {
			for (const set of step.sets.values()) {
				set.updateIsInvertedValues(newValues)
			}
		}

		const changedVariableEntities = this.#localVariables.updateIsInvertedValues(newValues)

		const changedFeedbackEntities = this.#feedbacks.updateIsInvertedValues(newValues)
		this.#emitFeedbackValueChangesForEntities(changedFeedbackEntities)

		this.tryTriggerLocalVariablesChanged(...changedVariableEntities)
	}

	#emitFeedbackValueChangesForEntities(changedFeedbackEntities: ControlEntityInstance[]): void {
		if (changedFeedbackEntities.length === 0) return

		// Collect affected element IDs from changed feedbacks that have style overrides
		const affectedElementIds = new Set<string>()
		for (const entity of changedFeedbackEntities) {
			// Only consider enabled feedbacks
			if (entity.disabled || !entity.styleOverrides) continue

			for (const override of entity.styleOverrides) {
				affectedElementIds.add(override.elementId)
			}
		}

		this.reportChange({
			redraw: true,
			noSave: true,
			changedElementIds: affectedElementIds.size > 0 ? affectedElementIds : undefined,
		})
	}
}

/**
 * The read-only button entity pool. Has the runtime step navigation surface ({@link ControlStepsRuntimeManager})
 * but none of the structural edit mutators - a preset reference constructs this, so it is read-only by
 * construction.
 */
export class ControlEntityListPoolButton extends ButtonEntityListPoolBase implements ControlStepsRuntimeManager {
	readonly isEditable = false
}

/**
 * The editable button entity pool: the shared {@link ButtonEntityListPoolBase} plus the structural entity-edit
 * and step/action-set-edit mutators (added by the editing mixins, which also set `isEditable = true`). Normal
 * layered buttons construct this.
 */
export class EditableControlEntityListPoolButton extends WithStepEditing(WithEntityEditing(ButtonEntityListPoolBase)) {}

/**
 * A button's entity pool: read-only or editable. Buttons hold this union so the button runtime can use the
 * shared step machinery while callers narrow on `isEditable` to reach the structural mutators.
 */
export type SomeButtonEntityPool = ControlEntityListPoolButton | EditableControlEntityListPoolButton

/**
 * Constructor for a button entity pool. A button control passes the read-only or editable class to its base
 * constructor, which decides (by construction) whether the control can be structurally edited. `TPool` is
 * carried through so the control's `entities` is typed as exactly the pool it constructs.
 */
export type ButtonEntityPoolConstructor<TPool extends SomeButtonEntityPool> = new (
	props: ControlEntityListPoolProps,
	sendRuntimePropsChange: () => void,
	executeExpressionInControl: (expression: string, requiredType?: string) => ExecuteExpressionResult,
	isLayeredButton: boolean
) => TPool
