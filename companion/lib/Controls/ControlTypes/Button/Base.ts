import { ControlBase } from '../../ControlBase.js'
import type { ControlWithEntities, ControlWithOptions, ControlWithPushed } from '../../IControlFragments.js'
import type { ButtonOptionsBase, ButtonStatus } from '@companion-app/shared/Model/ButtonModel.js'
import type { ControlDependencies } from '../../ControlDependencies.js'
import { ControlActionRunner } from '../../ActionRunner.js'
import { ControlEntityListPoolButton } from '../../Entities/EntityListPoolButton.js'
import { EntityModelType } from '@companion-app/shared/Model/EntityModel.js'
import type { ActionSetId } from '@companion-app/shared/Model/ActionModel.js'
import type { DrawStyleButtonStateProps } from '@companion-app/shared/Model/StyleModel.js'
import type { JsonValue } from 'type-fest'

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
 */
export abstract class ButtonControlBase<TJson, TOptions extends ButtonOptionsBase>
	extends ControlBase<TJson>
	implements ControlWithEntities, ControlWithOptions, ControlWithPushed
{
	readonly supportsEntities = true
	readonly supportsOptions = true
	readonly supportsPushed = true

	/**
	 * The defaults options for a button
	 */
	static DefaultOptions: ButtonOptionsBase = {
		stepProgression: 'auto',
		stepExpression: '',
	}

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
				instanceDefinitions: deps.instance.definitions,
				internalModule: deps.internalModule,
				processManager: deps.instance.processManager,
				variableValues: deps.variableValues,
				pageStore: deps.pageStore,
			},
			this.sendRuntimePropsChange.bind(this),
			(expression, requiredType, injectedVariableValues) =>
				deps.variableValues
					.createVariablesAndExpressionParser(
						deps.pageStore.getLocationOfControlId(this.controlId),
						this.entities.getLocalVariableEntities(),
						injectedVariableValues ?? null
					)
					.executeExpression(expression, requiredType)
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

	abortDelayedActionsSingle(skip_up: boolean, exceptSignal: AbortSignal): void {
		if (skip_up) {
			this.setPushed(false)
		}

		this.actionRunner.abortSingle(exceptSignal)
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
			const connectionStatus = this.deps.instance.getInstanceStatus(connectionId)
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
	 * Prepare this control for deletion
	 */
	destroy(): void {
		this.abortRunningHoldTimers(undefined)

		this.entities.destroy()

		super.destroy()
	}

	protected getDrawStyleButtonStateProps(): DrawStyleButtonStateProps {
		const result: DrawStyleButtonStateProps = {
			cloud: false,
			cloud_error: false,

			stepCurrent: this.entities.getActiveStepIndex() + 1,
			stepCount: this.entities.getStepIds().length,

			pushed: !!this.pushed,
			action_running: this.actionRunner.hasRunningChains,
			button_status: this.button_status,
		}

		return result
	}

	abstract onVariablesChanged(allChangedVariables: ReadonlySet<string>): void

	/**
	 * Update an option field of this control
	 */
	optionsSetField(key: string, value: JsonValue): boolean {
		// Check if rotary_actions should be added/remove
		if (key === 'rotaryActions') {
			this.entities.setupRotaryActionSets(!!value, true)
		}

		// @ts-expect-error mismatch in key type
		this.options[key] = value

		this.commitChange()

		return true
	}

	/**
	 * If this control was imported to a running system, do some data cleanup/validation
	 */
	protected postProcessImport(): void {
		this.entities.resubscribeEntities()

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
		const [thisStepId, nextStepId] = this.entities.validateCurrentStepIdAndGetNextProgression()

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
				this.options.stepProgression === 'auto' &&
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

				const location = this.deps.pageStore.getLocationOfControlId(this.controlId)

				if (!pressed && pressedDuration) {
					// find the correct set to execute on up

					const setIds = step.sets
						.keys()
						.map((id) => Number(id))
						.filter((id) => !isNaN(id) && id < pressedDuration)
						.toArray()
					if (setIds.length) {
						actionSetId = Math.max(...setIds)
					}
				}

				const runActionSet = (setId: ActionSetId): void => {
					const actions = step.sets.get(setId)
					if (!actions) return

					this.logger.silly(`found ${actions.length} actions`)
					this.actionRunner
						.runActions(actions, {
							surfaceId,
							location,
						})
						.catch((e) => {
							this.logger.error(`action execution failed: ${e}`)
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
	 * @param rightward Whether the control was rotated to the right
	 * @param surfaceId The surface that initiated this rotate
	 */
	rotateControl(rightward: boolean, surfaceId: string | undefined): void {
		const actions = this.entities.getActionsToExecuteForSet(rightward ? 'rotate_right' : 'rotate_left')

		const location = this.deps.pageStore.getLocationOfControlId(this.controlId)

		this.logger.silly(`found ${actions.length} actions`)
		this.actionRunner
			.runActions(actions, {
				surfaceId,
				location,
			})
			.catch((e) => {
				this.logger.error(`action execution failed: ${e}`)
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
			const location = this.deps.pageStore.getLocationOfControlId(this.controlId)
			if (location) {
				this.deps.events.emit('updateButtonState', location, this.pushed, surfaceId)
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
