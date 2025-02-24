import { ControlBase } from '../../ControlBase.js'
import type { ControlWithOptions, ControlWithPushed } from '../../IControlFragments.js'
import type { ButtonOptionsBase, ButtonStatus } from '@companion-app/shared/Model/ButtonModel.js'
import type { ControlDependencies } from '../../ControlDependencies.js'
import { ControlActionRunner } from '../../ActionRunner.js'
import { ControlEntityListPoolButton } from '../../Entities/EntityListPoolButton.js'
import { EntityModelType } from '@companion-app/shared/Model/EntityModel.js'
import { ActionSetId } from '@companion-app/shared/Model/ActionModel.js'
import { DrawStyleButtonStateProps } from '@companion-app/shared/Model/StyleModel.js'

/**
 * Abstract class for a editable button control.
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
export abstract class ButtonControlBase<TJson, TOptions extends Record<string, any>>
	extends ControlBase<TJson>
	implements ControlWithOptions, ControlWithPushed
{
	readonly supportsEntities = true
	readonly supportsOptions = true
	readonly supportsPushed = true

	/**
	 * The defaults options for a button
	 */
	static DefaultOptions: ButtonOptionsBase = {}

	/**
	 * Button hold state for each surface
	 */
	#surfaceHoldState = new Map<string, SurfaceHoldState>()

	/**
	 * The current status of this button
	 */
	button_status: ButtonStatus = 'good'

	/**
	 * The config of this button
	 */
	options!: TOptions

	/**
	 * Whether this button is currently pressed
	 */
	pushed = false

	readonly entities: ControlEntityListPoolButton

	protected readonly actionRunner: ControlActionRunner

	constructor(deps: ControlDependencies, controlId: string, debugNamespace: string) {
		super(deps, controlId, debugNamespace)

		this.actionRunner = new ControlActionRunner(deps.actionRunner, this.controlId, this.triggerRedraw.bind(this))

		this.entities = new ControlEntityListPoolButton(
			{
				controlId,
				commitChange: this.commitChange.bind(this),
				invalidateControl: this.triggerRedraw.bind(this),
				localVariablesChanged: this.onLocalVariablesChanged.bind(this),
				instanceDefinitions: deps.instance.definitions,
				internalModule: deps.internalModule,
				moduleHost: deps.instance.moduleHost,
			},
			this.sendRuntimePropsChange.bind(this)
		)
	}

	/**
	 * Abort pending delayed actions for a control
	 * @param skip_up Mark button as released
	 */
	abortDelayedActions(skip_up: boolean, exceptSignal: AbortSignal | null): void {
		if (skip_up) {
			this.setPushed(false)
		}

		this.actionRunner.abortAll(exceptSignal)
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
	 * Check the status of a control, and re-draw if needed
	 * @param redraw whether to perform a draw
	 * @returns whether the status changed
	 */
	checkButtonStatus = (redraw = true): boolean => {
		// Find all the connections referenced by the button
		const connectionIds = this.entities.getAllEnabledConnectionIds()

		// Figure out the combined status
		let status: ButtonStatus = 'good'
		for (const connectionId of connectionIds) {
			const connectionStatus = this.deps.instance.getConnectionStatus(connectionId)
			if (connectionStatus) {
				// TODO - can this be made simpler
				switch (connectionStatus.category) {
					case 'error':
						status = 'error'
						break
					case 'warning':
						if (status !== 'error') {
							status = 'warning'
						}
						break
				}
			}
		}

		// If the status has changed, emit the eent
		if (status != this.button_status) {
			this.button_status = status
			if (redraw) this.triggerRedraw()
			return true
		} else {
			return false
		}
	}

	/**
	 * Remove any tracked state for a connection
	 */
	clearConnectionState(connectionId: string): void {
		this.entities.clearConnectionState(connectionId)
	}

	/**
	 * Prepare this control for deletion
	 */
	destroy(): void {
		this.abortRunningHoldTimers(undefined)

		this.entities.destroy()

		super.destroy()
	}

	/**
	 * Remove any actions and feedbacks referencing a specified connectionId
	 */
	forgetConnection(connectionId: string): void {
		const changed = this.entities.forgetConnection(connectionId)

		if (changed) {
			this.commitChange(true)
		}
	}

	protected getDrawStyleButtonStateProps(): DrawStyleButtonStateProps {
		const result: DrawStyleButtonStateProps = {
			cloud: false,
			cloud_error: false,

			step_cycle: undefined,

			pushed: !!this.pushed,
			action_running: this.actionRunner.hasRunningChains,
			button_status: this.button_status,
		}

		if (this.entities.getStepIds().length > 1) {
			result.step_cycle = this.entities.getActiveStepIndex() + 1
		}

		return result
	}

	onLocalVariablesChanged(allChangedVariables: Set<string>): void {
		this.onVariablesChanged(allChangedVariables)

		this.deps.internalModule.onVariablesChanged(allChangedVariables, this.controlId)
	}

	abstract onVariablesChanged(allChangedVariables: Set<string>): void

	/**
	 * Update an option field of this control
	 */
	optionsSetField(key: string, value: any): boolean {
		// Check if rotary_actions should be added/remove
		if (key === 'rotaryActions') {
			this.entities.setupRotaryActionSets(!!value, true)
		}

		// @ts-ignore
		this.options[key] = value

		this.commitChange()

		return true
	}

	/**
	 * If this control was imported to a running system, do some data cleanup/validation
	 */
	protected postProcessImport(): void {
		this.entities.postProcessImport().catch((e) => {
			this.logger.silly(`postProcessImport for ${this.controlId} failed: ${e.message}`)
		})

		this.commitChange()
		this.sendRuntimePropsChange()
	}

	/**
	 * Execute a press of this control
	 * @param pressed Whether the control is pressed
	 * @param surfaceId The surface that initiated this press
	 * @param force Trigger actions even if already in the state
	 */
	pressControl(pressed: boolean, surfaceId: string | undefined, force: boolean): void {
		const [thisStepId, nextStepId] = this.entities.validateCurrentStepIdAndGetNext()

		let pressedDuration = 0
		let pressedStep = thisStepId
		let holdState: SurfaceHoldState | undefined = undefined
		if (surfaceId) {
			// Calculate the press duration, or track when the press started
			if (pressed) {
				this.abortRunningHoldTimers(surfaceId)

				holdState = {
					pressed: Date.now(),
					step: thisStepId,
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
				thisStepId !== null &&
				nextStepId !== null &&
				this.options.stepAutoProgress &&
				!pressed &&
				(pressedStep === undefined || thisStepId === pressedStep)
			) {
				// update what the new step will be
				this.entities.stepSelectCurrent(nextStepId)
			}

			// Make sure to execute for the step that was active when the press started
			const step = pressedStep ? this.entities.getStepActions(pressedStep) : null
			if (step) {
				let actionSetId: ActionSetId = pressed ? 'down' : 'up'

				const location = this.deps.page.getLocationOfControlId(this.controlId)

				if (!pressed && pressedDuration) {
					// find the correct set to execute on up

					const setIds = Object.keys(step)
						.map((id) => Number(id))
						.filter((id) => !isNaN(id) && id < pressedDuration)
					if (setIds.length) {
						actionSetId = Math.max(...setIds)
					}
				}

				const runActionSet = (setId: ActionSetId): void => {
					const actions = step.sets.get(setId)
					if (!actions) return

					this.logger.silly(`found ${actions.length} actions`)
					this.actionRunner.runActions(actions, {
						surfaceId,
						location,
					})
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
				if (typeof actionSetId !== 'number' || !step.options.runWhileHeld.includes(actionSetId)) {
					runActionSet(actionSetId)
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
		const actions = this.entities.getActionsToExecuteForSet(direction ? 'rotate_right' : 'rotate_left')

		const location = this.deps.page.getLocationOfControlId(this.controlId)

		this.logger.silly(`found ${actions.length} actions`)
		this.actionRunner.runActions(actions, {
			surfaceId,
			location,
		})
	}

	/**
	 * Set the button as being pushed.
	 * Notifies interested observers
	 * @param direction new state
	 * @param surfaceId surface which triggered the change
	 * @returns the pushed state changed
	 */
	setPushed(direction: boolean, surfaceId?: string): boolean {
		const wasPushed = this.pushed
		// Record is as pressed
		this.pushed = !!direction

		if (this.pushed !== wasPushed) {
			// TODO - invalidate feedbacks?

			const location = this.deps.page.getLocationOfControlId(this.controlId)
			if (location) {
				this.deps.events.emit('updateButtonState', location, this.pushed, surfaceId)
				// this.deps.services.emberplus.updateButtonState(location, this.pushed, surfaceId)
			}

			this.triggerRedraw()

			return true
		} else {
			return false
		}
	}

	/**
	 * Inform the control that it has been moved, and anything relying on its location must be invalidated
	 */
	triggerLocationHasChanged(): void {
		this.entities.resubscribeEntities(EntityModelType.Feedback, 'internal')
	}
}

interface SurfaceHoldState {
	pressed: number
	step: string | null
	timers: NodeJS.Timeout[]
}
