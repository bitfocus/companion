import { ButtonControlBase } from './Base.js'
import { cloneDeep } from 'lodash-es'
import { VisitorReferencesCollector } from '../../../Resources/Visitors/ReferencesCollector.js'
import type { ControlWithActionSets, ControlWithActions, ControlWithoutEvents } from '../../IControlFragments.js'
import { ReferencesVisitors } from '../../../Resources/Visitors/ReferencesVisitors.js'
import type { NormalButtonModel, NormalButtonOptions } from '@companion-app/shared/Model/ButtonModel.js'
import type { ActionSetId } from '@companion-app/shared/Model/ActionModel.js'
import type { DrawStyleButtonModel } from '@companion-app/shared/Model/StyleModel.js'
import type { ControlDependencies } from '../../ControlDependencies.js'
import { EntityModelType } from '@companion-app/shared/Model/EntityModel.js'
import type { ControlActionSetAndStepsManager } from '../../Fragments/ControlActionSetAndStepsManager.js'

/**
 * Class for the stepped button control.
 *
 * @author Håkon Nessjøen <haakon@bitfocus.io>
 * @author Keith Rocheck <keith.rocheck@gmail.com>
 * @author William Viker <william@bitfocus.io>
 * @author Julian Waller <me@julusian.co.uk>
 * @since 3.0.0
 * @copyright 2022 Bitfocus AS
 * @license
 * This program is free software.
 * You should have received a copy of the MIT licence as well as the Bitfocus
 * Individual Contributor License Agreement for Companion along with
 * this program.
 *
 * You can be released from the requirements of the license by purchasing
 * a commercial license. Buying such a license is mandatory as soon as you
 * develop commercial activities involving the Companion software without
 * disclosing the source code of your own applications.
 */
export class ControlButtonNormal
	extends ButtonControlBase<NormalButtonModel, NormalButtonOptions>
	implements ControlWithActions, ControlWithoutEvents, ControlWithActionSets
{
	readonly type = 'button'

	readonly supportsActions = true
	readonly supportsEvents = false
	readonly supportsActionSets = true

	/**
	 * Button hold state for each surface
	 */
	#surfaceHoldState = new Map<string, SurfaceHoldState>()

	get actionSets(): ControlActionSetAndStepsManager {
		return this.entities
	}

	constructor(deps: ControlDependencies, controlId: string, storage: NormalButtonModel | null, isImport: boolean) {
		super(deps, controlId, `Controls/Button/Normal/${controlId}`)

		this.options = {
			...cloneDeep(ButtonControlBase.DefaultOptions),
			rotaryActions: false,
			stepAutoProgress: true,
		}

		if (!storage) {
			// New control

			// Save the change
			this.commitChange()
			this.sendRuntimePropsChange()
		} else {
			if (storage.type !== 'button') throw new Error(`Invalid type given to ControlButtonStep: "${storage.type}"`)

			this.options = Object.assign(this.options, storage.options || {})
			this.feedbacks.baseStyle = Object.assign(this.feedbacks.baseStyle, storage.style || {})
			this.entities.loadStorage(storage, true, isImport)

			// Ensure control is stored before setup
			if (isImport) setImmediate(() => this.postProcessImport())
		}
	}

	/**
	 * Abort any running 'while held' timers
	 */
	private abortRunningHoldTimers(surfaceId: string | undefined): void {
		if (surfaceId) {
			const existingState = this.#surfaceHoldState.get(surfaceId)
			if (existingState) {
				// Cancel any pending 'runWhileHeld' timers
				for (const timer of existingState.timers) {
					clearTimeout(timer)
				}
			}
			this.#surfaceHoldState.delete(surfaceId)
		} else {
			for (const holdState of this.#surfaceHoldState.values()) {
				if (holdState) {
					// Cancel any pending 'runWhileHeld' timers
					for (const timer of holdState.timers) {
						clearTimeout(timer)
					}
				}
			}
			this.#surfaceHoldState.clear()
		}
	}

	/**
	 * Prepare this control for deletion
	 */
	destroy(): void {
		this.abortRunningHoldTimers(undefined)

		super.destroy()
	}

	/**
	 * Get the complete style object of a button
	 */
	override getDrawStyle(): DrawStyleButtonModel {
		const style = super.getDrawStyle()
		if (!style) return style

		if (this.entities.getStepIds().length > 1) {
			style.step_cycle = this.entities.getActiveStepIndex() + 1
		}

		return style
	}

	/**
	 * Collect the instance ids and labels referenced by this control
	 * @param foundConnectionIds - instance ids being referenced
	 * @param foundConnectionLabels - instance labels being referenced
	 */
	collectReferencedConnections(foundConnectionIds: Set<string>, foundConnectionLabels: Set<string>): void {
		const allEntities = this.entities.getAllEntities()

		for (const entity of allEntities) {
			foundConnectionIds.add(entity.connectionId)
		}

		const visitor = new VisitorReferencesCollector(foundConnectionIds, foundConnectionLabels)

		ReferencesVisitors.visitControlReferences(
			this.deps.internalModule,
			visitor,
			this.feedbacks.baseStyle,
			[],
			allEntities,
			[]
		)
	}

	/**
	 * Inform the control that it has been moved, and anything relying on its location must be invalidated
	 */
	triggerLocationHasChanged(): void {
		this.entities.resubscribeEntities(EntityModelType.Feedback, 'internal')
	}

	/**
	 * Update an option field of this control
	 */
	optionsSetField(key: string, value: any): boolean {
		// Check if rotary_actions should be added/remove
		if (key === 'rotaryActions') {
			this.entities.setupRotaryActionSets(!!value, true)
		}

		return super.optionsSetField(key, value)
	}

	/**
	 * Execute a press of this control
	 * @param pressed Whether the control is pressed
	 * @param surfaceId The surface that initiated this press
	 * @param force Trigger actions even if already in the state
	 */
	pressControl(pressed: boolean, surfaceId: string | undefined, force: boolean): void {
		const [this_step_id, next_step_id] = this.entities.validateCurrentStepIdAndGetNext()

		let pressedDuration = 0
		let pressedStep = this_step_id
		let holdState: SurfaceHoldState | undefined = undefined
		if (surfaceId) {
			// Calculate the press duration, or track when the press started
			if (pressed) {
				this.abortRunningHoldTimers(surfaceId)

				holdState = {
					pressed: Date.now(),
					step: this_step_id,
					timers: [],
				}
				this.#surfaceHoldState.set(surfaceId, holdState)
			} else {
				const state = this.#surfaceHoldState.get(surfaceId)
				if (state) {
					pressedDuration = Date.now() - state.pressed
					pressedStep = state.step

					this.abortRunningHoldTimers(surfaceId)
				}
			}
		}

		const changed = this.setPushed(pressed, surfaceId)

		// if the state has changed, the choose the set to execute
		if (changed || force) {
			// progress to the next step, if there is one, and the step hasnt already been changed
			if (
				this_step_id !== null &&
				next_step_id !== null &&
				this.options.stepAutoProgress &&
				!pressed &&
				(pressedStep === undefined || this_step_id === pressedStep)
			) {
				// update what the new step will be
				this.#current_step_id = next_step_id

				this.sendRuntimePropsChange()
			}

			// Make sure to execute for the step that was active when the press started
			const step = pressedStep && this.steps[pressedStep]
			if (step) {
				let action_set_id: ActionSetId = pressed ? 'down' : 'up'

				const location = this.deps.page.getLocationOfControlId(this.controlId)

				if (!pressed && pressedDuration) {
					// find the correct set to execute on up

					const setIds = step
						.getActionSetIds()
						.map((id) => Number(id))
						.filter((id) => !isNaN(id) && id < pressedDuration)
					if (setIds.length) {
						action_set_id = Math.max(...setIds)
					}
				}

				const runActionSet = (set_id: ActionSetId): void => {
					const actions = step.getActionSet(set_id)
					if (actions) {
						this.logger.silly('found actions')

						this.actionRunner.runActions(actions.asActionInstances(), {
							surfaceId,
							location,
						})
					}
				}

				if (pressed && holdState && holdState.timers.length === 0) {
					// queue any 'runWhileHeld' timers
					const times = [...step.options.runWhileHeld].sort()

					for (const time of times) {
						holdState.timers.push(
							setTimeout(() => {
								try {
									runActionSet(time)
								} catch (e) {
									this.logger.warn(`hold actions execution failed: ${e}`)
								}
							}, time)
						)
					}
				}

				// Run the actions if it wasn't already run from being held
				if (typeof action_set_id !== 'number' || !step.options.runWhileHeld.includes(action_set_id)) {
					runActionSet(action_set_id)
				}
			}
		}
	}

	/**
	 * Execute a rotate of this control
	 * @param direction Whether the control was rotated to the right
	 * @param surfaceId The surface that initiated this rotate
	 */
	rotateControl(direction: boolean, surfaceId: string | undefined): void {
		const [this_step_id] = this.entities.validateCurrentStepIdAndGetNext()

		const step = this_step_id && this.steps[this_step_id]
		if (step) {
			const action_set_id = direction ? 'rotate_right' : 'rotate_left'

			const actions = step.getActionSet(action_set_id)
			if (actions) {
				this.logger.silly('found actions')

				const location = this.deps.page.getLocationOfControlId(this.controlId)

				this.actionRunner.runActions(actions.asActionInstances(), {
					surfaceId,
					location,
				})
			}
		}
	}

	/**
	 * Convert this control to JSON
	 * To be sent to the client and written to the db
	 * @param clone - Whether to return a cloned object
	 */
	override toJSON(clone = true): NormalButtonModel {
		const obj: NormalButtonModel = {
			type: this.type,
			style: this.feedbacks.baseStyle,
			options: this.options,
			feedbacks: this.entities.getFeedbackInstances(),
			steps: this.entities.asActionStepsModel(),
		}

		return clone ? cloneDeep(obj) : obj
	}

	/**
	 * Get any volatile properties for the control
	 */
	override toRuntimeJSON() {
		return {
			current_step_id: this.entities.currentStepId,
		}
	}
}

interface SurfaceHoldState {
	pressed: number
	step: string | null
	timers: NodeJS.Timeout[]
}
