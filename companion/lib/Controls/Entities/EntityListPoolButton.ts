import { NormalButtonModel, NormalButtonOptions, NormalButtonSteps } from '@companion-app/shared/Model/ButtonModel.js'
import {
	EntityModelType,
	SomeEntityModel,
	type SomeSocketEntityLocation,
} from '@companion-app/shared/Model/EntityModel.js'
import { ButtonStyleProperties, UnparsedButtonStyle } from '@companion-app/shared/Model/StyleModel.js'
import { ControlEntityList } from './EntityList.js'
import { ControlEntityListPoolBase, ControlEntityListPoolProps } from './EntityListPoolBase.js'
import { FeedbackStyleBuilder } from './FeedbackStyleBuilder.js'
import type { ActionSetId, ActionSetsModel, ActionStepOptions } from '@companion-app/shared/Model/ActionModel.js'
import type { ControlActionSetAndStepsManager } from './ControlActionSetAndStepsManager.js'
import { cloneDeep } from 'lodash-es'
import { validateActionSetId } from '@companion-app/shared/ControlId.js'
import type { ControlEntityInstance } from './EntityInstance.js'
import { assertNever } from '@companion-app/shared/Util.js'
import type { CompanionVariableValues } from '@companion-module/base'
import type { ExecuteExpressionResult } from '@companion-app/shared/Expression/ExpressionResult.js'

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

export class ControlEntityListPoolButton extends ControlEntityListPoolBase implements ControlActionSetAndStepsManager {
	/**
	 * The defaults options for a step
	 */
	static DefaultStepOptions: ActionStepOptions = {
		runWhileHeld: [], // array of set ids
	}

	readonly #feedbacks: ControlEntityList

	readonly #steps = new Map<string, ControlEntityListActionStep>()

	readonly #executeExpressionInControl: (
		expression: string,
		requiredType?: string,
		injectedVariableValues?: CompanionVariableValues
	) => ExecuteExpressionResult
	readonly #sendRuntimePropsChange: () => void

	/**
	 * The current step
	 */
	#currentStep: CurrentStepFromExpression | CurrentStepFromId = { type: 'id', id: '0' }

	#hasRotaryActions = false

	get currentStepId(): string {
		switch (this.#currentStep.type) {
			case 'id':
				return this.#currentStep.id
			case 'expression':
				return this.#currentStep.lastStepId
			default:
				assertNever(this.#currentStep)
				throw new Error('Unsupported step mode')
		}
	}

	constructor(
		props: ControlEntityListPoolProps,
		sendRuntimePropsChange: () => void,
		executeExpressionInControl: (
			expression: string,
			requiredType?: string,
			injectedVariableValues?: CompanionVariableValues
		) => ExecuteExpressionResult
	) {
		super(props)

		this.#executeExpressionInControl = executeExpressionInControl
		this.#sendRuntimePropsChange = sendRuntimePropsChange

		this.#feedbacks = new ControlEntityList(
			props.instanceDefinitions,
			props.internalModule,
			props.moduleHost,
			props.controlId,
			null,
			{
				type: EntityModelType.Feedback,
			}
		)

		this.#currentStep = { type: 'id', id: '0' }

		this.#steps.set('0', this.#getNewStepValue(null, null))
	}

	loadStorage(storage: NormalButtonModel, skipSubscribe: boolean, isImport: boolean): void {
		this.#feedbacks.loadStorage(storage.feedbacks || [], skipSubscribe, isImport)

		// Future:	cleanup the steps/sets
		this.#steps.clear()

		for (const [id, stepObj] of Object.entries(storage.steps ?? {})) {
			this.#steps.set(id, this.#getNewStepValue(stepObj.action_sets, stepObj.options))
		}

		this.#currentStep = { type: 'id', id: this.getStepIds()[0] } // TODO - other modes?
	}

	/**
	 * Get direct the feedback instances
	 */
	getFeedbackEntities(): SomeEntityModel[] {
		return this.#feedbacks.getDirectEntities().map((ent) => ent.asEntityModel(true))
	}

	// /**
	//  * Get direct the action instances
	//  */
	// getActionEntities(): SomeEntityModel[] {
	// 	return this.#actions.getDirectEntities().map((ent) => ent.asEntityModel(true))
	// }
	asNormalButtonSteps(): NormalButtonSteps {
		const stepsJson: NormalButtonSteps = {}
		for (const [id, step] of this.#steps) {
			stepsJson[id] = {
				action_sets: this.#stepAsActionSetsModel(step),
				options: step.options,
			}
		}

		return stepsJson
	}

	#stepAsActionSetsModel(step: ControlEntityListActionStep): ActionSetsModel {
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

		if (typeof listId === 'object' && 'setId' in listId && 'stepId' in listId) {
			return this.#steps.get(listId.stepId)?.sets.get(listId.setId)
		}

		return undefined
	}

	protected getAllEntityLists(): ControlEntityList[] {
		const entityLists: ControlEntityList[] = [this.#feedbacks]

		for (const step of this.#steps.values()) {
			entityLists.push(...Array.from(step.sets.values()))
		}

		return entityLists
	}

	/**
	 * Get the unparsed style for the feedbacks
	 * Note: Does not clone the style
	 */
	getUnparsedFeedbackStyle(baseStyle: ButtonStyleProperties): UnparsedButtonStyle {
		const styleBuilder = new FeedbackStyleBuilder(baseStyle)
		this.#feedbacks.buildFeedbackStyle(styleBuilder)
		return styleBuilder.style
	}

	getStepIds(): string[] {
		return Array.from(this.#steps.keys()).sort((a, b) => Number(a) - Number(b))
	}

	actionSetAdd(stepId: string): boolean {
		const step = this.#steps.get(stepId)
		if (!step) return false

		const existingKeys = Array.from(step.sets.keys())
			.map((k) => Number(k))
			.filter((k) => !isNaN(k))
		if (existingKeys.length === 0) {
			// add the default '1000' set
			step.sets.set(1000, this.#createActionEntityList([], false, false))

			this.commitChange(true)

			return true
			// return 1000
		} else {
			// add one after the last
			const max = Math.max(...existingKeys)
			const newIndex = Math.floor(max / 1000) * 1000 + 1000

			step.sets.set(newIndex, this.#createActionEntityList([], false, false))

			this.commitChange(false)

			return true
			// return newIndex
		}
	}

	actionSetRemove(stepId: string, setId: ActionSetId): boolean {
		const step = this.#steps.get(stepId)
		if (!step) return false

		// Ensure is a valid number
		const setIdNumber = Number(setId)
		if (isNaN(setIdNumber)) return false

		const setToRemove = step.sets.get(setIdNumber)
		if (!setToRemove) return false

		// Inform modules of the change
		setToRemove.cleanup()

		// Forget the step from the options
		step.options.runWhileHeld = step.options.runWhileHeld.filter((id) => id !== setIdNumber)

		// Assume it exists
		step.sets.delete(setIdNumber)

		// Save the change, and perform a draw
		this.commitChange(true)

		return true
	}

	actionSetRename(stepId: string, oldSetId: ActionSetId, newSetId: ActionSetId): boolean {
		const step = this.#steps.get(stepId)
		if (!step) return false

		const newSetIdNumber = Number(newSetId)
		const oldSetIdNumber = Number(oldSetId)

		// Only valid when both are numbers
		if (isNaN(newSetIdNumber) || isNaN(oldSetIdNumber)) return false

		// Ensure old set exists
		const oldSet = step.sets.get(oldSetIdNumber)
		if (!oldSet) return false

		// Ensure new set doesnt already exist
		if (step.sets.has(newSetIdNumber)) return false

		// Rename the set
		step.sets.set(newSetIdNumber, oldSet)
		step.sets.delete(oldSetIdNumber)

		// Update the runWhileHeld options
		const runWhileHeldIndex = step.options.runWhileHeld.indexOf(oldSetIdNumber)
		if (runWhileHeldIndex !== -1) step.options.runWhileHeld[runWhileHeldIndex] = newSetIdNumber

		this.commitChange(false)

		return true
	}

	actionSetRunWhileHeld(stepId: string, setId: ActionSetId, runWhileHeld: boolean): boolean {
		const step = this.#steps.get(stepId)
		if (!step) return false

		// Ensure it is a number
		const setIdNumber = Number(setId)

		// Only valid when step is a number
		if (isNaN(setIdNumber)) return false

		// Ensure set exists
		if (!step.sets.get(setIdNumber)) return false

		const runWhileHeldIndex = step.options.runWhileHeld.indexOf(setIdNumber)
		if (runWhileHeld && runWhileHeldIndex === -1) {
			step.options.runWhileHeld.push(setIdNumber)
		} else if (!runWhileHeld && runWhileHeldIndex !== -1) {
			step.options.runWhileHeld.splice(runWhileHeldIndex, 1)
		}

		this.commitChange(false)

		return true
	}

	setupRotaryActionSets(ensureCreated: boolean, skipCommit?: boolean): void {
		// Cache the value
		this.#hasRotaryActions = ensureCreated

		for (const step of this.#steps.values()) {
			if (ensureCreated) {
				// ensure they exist
				if (!step.sets.has('rotate_left')) step.sets.set('rotate_left', this.#createActionEntityList([], false, false))
				if (!step.sets.has('rotate_right'))
					step.sets.set('rotate_right', this.#createActionEntityList([], false, false))
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

		if (!skipCommit) this.commitChange(true)
	}

	#createActionEntityList(entities: SomeEntityModel[], skipSubscribe: boolean, isCloned: boolean): ControlEntityList {
		const list = this.createEntityList({ type: EntityModelType.Action })
		list.loadStorage(entities, skipSubscribe, isCloned)
		return list
	}

	#getNewStepValue(
		existingActions: ActionSetsModel | null,
		existingOptions: ActionStepOptions | null
	): ControlEntityListActionStep {
		const options = existingOptions || cloneDeep(ControlEntityListPoolButton.DefaultStepOptions)

		const downList = this.#createActionEntityList(existingActions?.down || [], false, !!existingActions)
		const upList = this.#createActionEntityList(existingActions?.up || [], false, !!existingActions)

		const sets = new Map<ActionSetId, ControlEntityList>()
		sets.set('down', downList)
		sets.set('up', upList)

		if (this.#hasRotaryActions) {
			sets.set(
				'rotate_left',
				this.#createActionEntityList(existingActions?.rotate_left || [], false, !!existingActions)
			)
			sets.set(
				'rotate_right',
				this.#createActionEntityList(existingActions?.rotate_right || [], false, !!existingActions)
			)
		}

		for (const setId in existingActions || {}) {
			const setIdNumber = validateActionSetId(setId as ActionSetId)
			if (typeof setIdNumber === 'number') {
				sets.set(
					setIdNumber,
					this.#createActionEntityList(existingActions?.[setIdNumber] || [], false, !!existingActions)
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
	 * Propogate variable changes, and update the current step if the variables affect it
	 */
	stepCheckExpressionOnVariablesChanged(changedVariables: Set<string>): void {
		if (this.#currentStep.type !== 'expression') return

		for (const variableName of this.#currentStep.lastVariables) {
			if (changedVariables.has(variableName)) {
				if (this.#stepCheckExpression(true)) {
					// Something changed, so redraw
					this.triggerRedraw()
				}
				return
			}
		}
	}

	/**
	 * Re-execute the expression, and update the current step if it has changed
	 * @param updateClient Whether to inform the client if the step changed
	 * @returns Whether a change was made
	 */
	#stepCheckExpression(updateClient: boolean): boolean {
		if (this.#currentStep.type !== 'expression') return false

		let changed = false

		const stepIds = this.getStepIds()

		const latestValue = this.#executeExpressionInControl(this.#currentStep.expression, 'number')
		if (latestValue.ok) {
			let latestIndex = Math.max(Math.min(Number(latestValue.value) - 1, stepIds.length - 1), 0)
			if (isNaN(latestIndex)) latestIndex = 0

			const newStepId = stepIds[latestIndex]

			// Check if this will change the expected state
			changed = this.#currentStep.lastStepId !== newStepId

			// Update the state
			this.#currentStep.lastStepId = newStepId
			this.#currentStep.lastVariables = latestValue.variableIds
		} else {
			// Lets always go to the first step, to ensure we have a sane and predictable value

			this.logger.warn(`Step expression failed to evaluate: ${latestValue.error}`)

			const firstStepId = stepIds[0]

			// Check if this will change the expected state
			changed = this.#currentStep.lastStepId !== firstStepId

			// Update the state
			this.#currentStep.lastStepId = firstStepId
			this.#currentStep.lastVariables = latestValue.variableIds
		}

		// Inform clients of the change
		if (changed && updateClient) this.#sendRuntimePropsChange()

		return changed
	}

	/**
	 * Update the step operation mode or expression upon button options change
	 * @param options
	 */
	stepExpressionUpdate(options: NormalButtonOptions): void {
		if (options.stepProgression === 'expression') {
			// It may have changed, assume it has and purge the existing state
			this.#currentStep = {
				type: 'expression',
				expression: options.stepExpression || '',
				lastStepId: this.getStepIds()[0],
				lastVariables: new Set(),
			}

			this.#stepCheckExpression(true)
		} else {
			if (this.#currentStep.type === 'expression') {
				// Stick to whatever is currently selected
				this.#currentStep = { type: 'id', id: this.currentStepId }
			}
		}
	}

	/**
	 * Add a step to this control
	 * @returns Id of new step
	 */
	stepAdd(): string {
		const existingKeys = this.getStepIds()
			.map((k) => Number(k))
			.filter((k) => !isNaN(k))

		const stepId = existingKeys.length === 0 ? '0' : `${Math.max(...existingKeys) + 1}`

		this.#steps.set(stepId, this.#getNewStepValue(null, null))

		// Ensure current step is valid
		this.#stepCheckExpression(true)

		this.commitChange(true)

		return stepId
	}

	/**
	 * Progress through the action-sets
	 * @param amount Number of steps to progress
	 */
	stepAdvanceDelta(amount: number): boolean {
		// If using an expression, don't allow manual progression
		if (this.#currentStep.type !== 'id') return false

		if (amount && typeof amount === 'number') {
			const all_steps = this.getStepIds()
			if (all_steps.length > 0) {
				const current = all_steps.indexOf(this.#currentStep.id)

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
	 * Duplicate a step on this control
	 * @param stepId the id of the step to duplicate
	 */
	stepDuplicate(stepId: string): boolean {
		const existingKeys = this.getStepIds()
			.map((k) => Number(k))
			.filter((k) => !isNaN(k))

		const stepToCopy = this.#steps.get(stepId)
		if (!stepToCopy) return false

		const newStep = this.#getNewStepValue(
			cloneDeep(this.#stepAsActionSetsModel(stepToCopy)),
			cloneDeep(stepToCopy.options)
		)

		// add one after the last
		const max = Math.max(...existingKeys)

		const newStepId = `${max + 1}`
		this.#steps.set(newStepId, newStep)

		// Ensure current step is valid
		this.#stepCheckExpression(false)

		// Ensure the ui knows which step is current
		this.#sendRuntimePropsChange()

		// Save the change, and perform a draw
		this.commitChange(true)

		return true
	}

	/**
	 * Set the current (next to execute) action-set by index
	 * @param index The step index to make the next
	 */
	stepMakeCurrent(index: number): boolean {
		// If using an expression, don't allow manual progression
		if (this.#currentStep.type !== 'id') return false

		if (typeof index === 'number') {
			const stepId = this.getStepIds()[index - 1]
			if (stepId !== undefined) {
				return this.stepSelectCurrent(stepId)
			}
		}

		return false
	}

	/**
	 * Remove an action-set from this control
	 * @param stepId the id of the action-set
	 */
	stepRemove(stepId: string): boolean {
		const oldKeys = this.getStepIds()

		// Ensure there is at least one step
		if (oldKeys.length === 1) return false

		const step = this.#steps.get(stepId)
		if (!step) return false

		for (const set of step.sets.values()) {
			set.cleanup()
		}
		this.#steps.delete(stepId)

		// Update the current step
		if (this.#currentStep.type === 'id') {
			const oldIndex = oldKeys.indexOf(stepId)
			let newIndex = oldIndex + 1
			if (newIndex >= oldKeys.length) {
				newIndex = 0
			}
			if (newIndex !== oldIndex) {
				this.#currentStep.id = oldKeys[newIndex]

				this.#sendRuntimePropsChange()
			}
		} else {
			// Ensure current step is valid
			this.#stepCheckExpression(true)
		}

		// Save the change, and perform a draw
		this.commitChange(true)

		return true
	}

	/**
	 * Set the current (next to execute) action-set by id
	 * @param stepId The step id to make the next
	 */
	stepSelectCurrent(stepId: string): boolean {
		// If using an expression, don't allow manual progression
		if (this.#currentStep.type !== 'id') return false

		const step = this.#steps.get(stepId)
		if (!step) return false

		// Ensure it isn't currently pressed
		// this.setPushed(false)

		this.#currentStep.id = stepId

		this.#sendRuntimePropsChange()

		this.triggerRedraw()

		return true
	}

	/**
	 * Swap two action-sets
	 * @param stepId1 One of the action-sets
	 * @param stepId2 The other action-set
	 */
	stepSwap(stepId1: string, stepId2: string): boolean {
		const step1 = this.#steps.get(stepId1)
		const step2 = this.#steps.get(stepId2)

		if (!step1 || !step2) return false

		this.#steps.set(stepId1, step2)
		this.#steps.set(stepId2, step1)

		// Ensure current step is valid
		this.#stepCheckExpression(true)

		this.commitChange(false)

		return true
	}

	/**
	 * Rename step
	 * @param stepId the id of the action-set
	 * @param newName the new name of the step
	 */
	stepRename(stepId: string, newName: string): boolean {
		const step = this.#steps.get(stepId)
		if (!step) return false

		step.options.name = newName

		this.commitChange(false)

		return true
	}

	validateCurrentStepIdAndGetNextProgression(): [string | null, string | null] {
		if (this.#currentStep.type === 'expression') {
			// When in the expression mode, the next step is unknown, but we can produce a sane current step id

			if (this.#stepCheckExpression(true)) {
				// Something changed, so redraw
				this.triggerRedraw()
			}

			return [this.#currentStep.lastStepId, null]
		}

		const stepIds = this.getStepIds()

		// For the automatic/manual progression
		const this_step_raw = this.#currentStep.id
		if (stepIds.length > 0) {
			// verify 'this_step_raw' is valid
			const this_step_index = stepIds.findIndex((s) => s == this_step_raw) || 0
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

		const step = this.#steps.get(this_step_id)
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
		const step = this.#steps.get(stepId)
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
}

interface ControlEntityListActionStep {
	readonly sets: Map<ActionSetId, ControlEntityList>
	options: ActionStepOptions
}
