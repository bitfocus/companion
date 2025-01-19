import { ControlBase } from '../../ControlBase.js'
import { GetButtonBitmapSize } from '../../../Resources/Util.js'
import { cloneDeep } from 'lodash-es'
import type { ControlWithOptions, ControlWithPushed, ControlWithStyle } from '../../IControlFragments.js'
import { ReferencesVisitors } from '../../../Resources/Visitors/ReferencesVisitors.js'
import type { ButtonOptionsBase, ButtonStatus } from '@companion-app/shared/Model/ButtonModel.js'
import type { DrawStyleButtonModel } from '@companion-app/shared/Model/StyleModel.js'
import type { CompanionVariableValues } from '@companion-module/base'
import type { ControlDependencies } from '../../ControlDependencies.js'
import { ControlActionRunner } from '../../ActionRunner.js'
import { ControlEntityListPoolButton } from '../../Entities/EntityListPoolButton.js'
import { EntityModelType } from '@companion-app/shared/Model/EntityModel.js'

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
	implements ControlWithStyle, ControlWithOptions, ControlWithPushed
{
	readonly supportsStyle = true
	readonly supportsEntities = true
	readonly supportsOptions = true
	readonly supportsPushed = true

	/**
	 * The defaults options for a button
	 */
	static DefaultOptions: ButtonOptionsBase = {}

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

	/**
	 * The variabls referenced in the last draw. Whenever one of these changes, a redraw should be performed
	 */
	protected last_draw_variables: Set<string> | null = null

	readonly entities: ControlEntityListPoolButton

	protected readonly actionRunner: ControlActionRunner

	constructor(deps: ControlDependencies, controlId: string, debugNamespace: string) {
		super(deps, controlId, debugNamespace)

		this.actionRunner = new ControlActionRunner(deps.actionRunner, this.controlId, this.triggerRedraw.bind(this))

		this.entities = new ControlEntityListPoolButton(
			{
				controlId,
				commitChange: this.commitChange.bind(this),
				triggerRedraw: this.triggerRedraw.bind(this),
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
	abortDelayedActions(skip_up: boolean): void {
		if (skip_up) {
			this.setPushed(false)
		}

		this.actionRunner.abortAll()
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

	/**
	 * Get the size of the bitmap render of this control
	 */
	getBitmapSize(): { width: number; height: number } | null {
		return GetButtonBitmapSize(this.deps.userconfig, this.entities.baseStyle)
	}

	/**
	 * Get the complete style object of a button
	 * @returns the processed style of the button
	 */
	getDrawStyle(): DrawStyleButtonModel {
		let style = this.entities.getUnparsedFeedbackStyle()

		if (style.text) {
			// Block out the button text
			const injectedVariableValues: CompanionVariableValues = {}
			const location = this.deps.page.getLocationOfControlId(this.controlId)
			if (location) {
				// Ensure we don't enter into an infinite loop
				// TODO - legacy location variables?
				injectedVariableValues[`$(internal:b_text_${location.pageNumber}_${location.row}_${location.column})`] = '$RE'
			}

			if (style.textExpression) {
				try {
					const parseResult = this.deps.variables.values.executeExpression(
						style.text,
						location,
						undefined,
						injectedVariableValues
					)
					style.text = parseResult.value + ''
					this.last_draw_variables = parseResult.variableIds.size > 0 ? parseResult.variableIds : null
				} catch (e) {
					this.logger.error(`Expression parse error: ${e}`)

					style.text = 'ERR'
					this.last_draw_variables = null
				}
			} else {
				const parseResult = this.deps.variables.values.parseVariables(style.text, location, injectedVariableValues)
				style.text = parseResult.text
				this.last_draw_variables = parseResult.variableIds.length > 0 ? new Set(parseResult.variableIds) : null
			}
		}

		return {
			cloud: false,
			cloud_error: false,

			...cloneDeep(style),

			step_cycle: undefined,

			pushed: !!this.pushed,
			action_running: this.actionRunner.hasRunningChains,
			button_status: this.button_status,

			style: 'button',
		}
	}

	/**
	 * Propagate variable changes
	 * @param allChangedVariables - variables with changes
	 */
	onVariablesChanged(allChangedVariables: Set<string>): void {
		if (this.last_draw_variables) {
			for (const variable of allChangedVariables.values()) {
				if (this.last_draw_variables.has(variable)) {
					this.logger.silly('variable changed in button ' + this.controlId)

					this.triggerRedraw()
					return
				}
			}
		}
	}

	/**
	 * Update an option field of this control
	 */
	optionsSetField(key: string, value: any): boolean {
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
	 * Rename a connection for variables used in this control
	 * @param labelFrom - the old connection short name
	 * @param labelTo - the new connection short name
	 */
	renameVariables(labelFrom: string, labelTo: string): void {
		const allEntities = this.entities.getAllEntities()

		// Fix up references
		const changed = ReferencesVisitors.fixupControlReferences(
			this.deps.internalModule,
			{ connectionLabels: { [labelFrom]: labelTo } },
			this.entities.baseStyle,
			[],
			allEntities,
			[],
			true
		)

		// redraw if needed and save changes
		this.commitChange(changed)
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
	 * Update the style fields of this control
	 * @param diff - config diff to apply
	 * @returns true if any changes were made
	 */
	styleSetFields(diff: Record<string, any>): boolean {
		if (diff.png64) {
			// Strip the prefix off the base64 png
			if (typeof diff.png64 === 'string' && diff.png64.match(/data:.*?image\/png/)) {
				diff.png64 = diff.png64.replace(/^.*base64,/, '')
			} else {
				// this.logger.info('png64 is not a png url')
				// Delete it
				delete diff.png64
			}
		}

		if (Object.keys(diff).length > 0) {
			// Apply the diff
			Object.assign(this.entities.baseStyle, diff)

			if ('show_topbar' in diff) {
				// Some feedbacks will need to redraw
				this.entities.resubscribeEntities(EntityModelType.Feedback)
			}

			this.commitChange()

			return true
		} else {
			return false
		}
	}
}
