import { NormalButtonModel, NormalButtonSteps } from '@companion-app/shared/Model/ButtonModel.js'
import { EntityModelType, type SomeSocketEntityLocation } from '@companion-app/shared/Model/EntityModel.js'
import { FeedbackInstance } from '@companion-app/shared/Model/FeedbackModel.js'
import { UnparsedButtonStyle } from '@companion-app/shared/Model/StyleModel.js'
import { ControlEntityList } from './EntityList.js'
import { ControlEntityListPoolBase, ControlEntityListPoolProps } from './EntityListPoolBase.js'
import { FeedbackStyleBuilder } from './FeedbackStyleBuilder.js'
import { transformEntityToFeedbacks } from './Util.js'
import type { ActionSetId, ActionStepOptions } from '@companion-app/shared/Model/ActionModel.js'
import { GetStepIds } from '@companion-app/shared/Controls.js'
import type { ControlActionSetAndStepsManager } from './ControlActionSetAndStepsManager.js'

export class ControlEntityListPoolButton extends ControlEntityListPoolBase implements ControlActionSetAndStepsManager {
	#feedbacks: ControlEntityList

	#steps: Map<string, ControlEntityListActionStep>

	constructor(props: ControlEntityListPoolProps) {
		super(props)

		this.#feedbacks = new ControlEntityList(
			props.instanceDefinitions,
			props.internalModule,
			props.moduleHost,
			props.controlId,
			null,
			{
				type: EntityModelType.Feedback,
				groupId: 'feedbacks',
				label: 'Feedbacks',
			}
		)
	}

	loadStorage(storage: NormalButtonModel, skipSubscribe: boolean, isImport: boolean) {
		this.#feedbacks.loadStorage(storage.feedbacks || [], skipSubscribe, isImport)
	}

	/**
	 * Get all the feedback instances
	 */
	getFeedbackInstances(): FeedbackInstance[] {
		return transformEntityToFeedbacks(this.#feedbacks.getDirectEntities())
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
	getUnparsedFeedbackStyle(): UnparsedButtonStyle {
		const styleBuilder = new FeedbackStyleBuilder(this.baseStyle)
		this.#feedbacks.buildFeedbackStyle(styleBuilder)
		return styleBuilder.style
	}

	getStepIds(): string[] {
		return GetStepIds(this.#steps)
	}

	asActionStepsModel(): NormalButtonSteps {
		const stepsJson: NormalButtonSteps = {}
		for (const [id, step] of this.#steps) {
			stepsJson[id] = {
				action_sets: step.asActionStepModel(),
				options: step.options,
			}
		}

		return stepsJson
	}

	actionSetAdd(stepId: string): boolean {
		const step = this.#steps.get(stepId)
		if (!step) return false

		const existingKeys = Array.from(step.sets.keys())
			.map((k) => Number(k))
			.filter((k) => !isNaN(k))
		if (existingKeys.length === 0) {
			// add the default '1000' set
			step.sets.set(
				1000,
				this.createEntityList({
					type: EntityModelType.Action,
					groupId: '',
					label: '',
				})
			)

			this.commitChange(true)

			return true
			// return 1000
		} else {
			// add one after the last
			const max = Math.max(...existingKeys)
			const newIndex = Math.floor(max / 1000) * 1000 + 1000

			step.sets.set(
				newIndex,
				this.createEntityList({
					type: EntityModelType.Action,
					groupId: '',
					label: '',
				})
			)

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
		for (const step of this.#steps.values()) {
			if (ensureCreated) {
				// ensure they exist
				if (!step.sets.has('rotate_left'))
					step.sets.set(
						'rotate_left',
						this.createEntityList({
							type: EntityModelType.Action,
							groupId: '',
							label: '',
						})
					)
				if (!step.sets.has('rotate_right'))
					step.sets.set(
						'rotate_right',
						this.createEntityList({
							type: EntityModelType.Action,
							groupId: '',
							label: '',
						})
					)
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
}

interface ControlEntityListActionStep {
	readonly sets: Map<ActionSetId, ControlEntityList>
	options: ActionStepOptions
}
