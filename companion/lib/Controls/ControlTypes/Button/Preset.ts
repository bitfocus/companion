import { ButtonControlBase } from './Base.js'
import { cloneDeep, omit } from 'lodash-es'
import { VisitorReferencesUpdater } from '../../../Resources/Visitors/ReferencesUpdater.js'
import { VisitorReferencesCollector } from '../../../Resources/Visitors/ReferencesCollector.js'
import type {
	ControlWithActionSets,
	ControlWithActions,
	ControlWithStyle,
	ControlWithoutEvents,
} from '../../IControlFragments.js'
import type {
	PresetButtonModel,
	NormalButtonOptions,
	NormalButtonRuntimeProps,
} from '@companion-app/shared/Model/ButtonModel.js'
import type { ButtonStyleProperties, DrawStyleButtonModel } from '@companion-app/shared/Model/StyleModel.js'
import type { ControlDependencies } from '../../ControlDependencies.js'
import type { ControlActionSetAndStepsManager } from '../../Entities/ControlActionSetAndStepsManager.js'
import type { CompanionVariableValues } from '@companion-module/base'
import { GetButtonBitmapSize } from '../../../Resources/Util.js'
import { ControlButtonNormal } from './Normal.js'
import type { ImageResult } from '../../../Graphics/ImageResult.js'

/**
 * Class for the preset button control.
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
export class ControlButtonPreset
	extends ButtonControlBase<PresetButtonModel, NormalButtonOptions>
	implements ControlWithStyle, ControlWithActions, ControlWithoutEvents, ControlWithActionSets
{
	readonly type = 'preset:button'

	readonly supportsActions = true
	readonly supportsEvents = false
	readonly supportsActionSets = true
	readonly supportsStyle = true
	readonly supportsLayeredStyle = false

	/**
	 * The variabls referenced in the last draw. Whenever one of these changes, a redraw should be performed
	 */
	#last_draw_variables: ReadonlySet<string> | null = null

	/**
	 * The base style without feedbacks applied
	 */
	#baseStyle: ButtonStyleProperties = cloneDeep(ControlButtonNormal.DefaultStyle)

	#lastRender: ImageResult | null = null

	get lastRender(): ImageResult | null {
		return this.#lastRender
	}

	get baseStyle(): ButtonStyleProperties {
		return this.#baseStyle
	}

	get actionSets(): ControlActionSetAndStepsManager {
		return this.entities
	}

	constructor(deps: ControlDependencies, controlId: string, storage: PresetButtonModel) {
		super(deps, controlId, `Controls/Button/Preset/${controlId}`, true)

		this.options = {
			...cloneDeep(ButtonControlBase.DefaultOptions),
			rotaryActions: false,
			stepProgression: 'auto',
		}

		if (storage.type !== 'preset:button')
			throw new Error(`Invalid type given to ControlButtonPreset: "${storage.type}"`)

		this.#baseStyle = Object.assign(this.#baseStyle, storage.style || {})
		this.options = Object.assign(this.options, storage.options || {})
		this.entities.loadStorage(storage, true, true)
		this.entities.stepExpressionUpdate(this.options)

		// Ensure control is stored before setup
		setImmediate(() => this.postProcessImport())

		this.deps.events.on('presetDrawn', this.#updateLastRender)
	}

	/**
	 * Prepare this control for deletion
	 */
	destroy(): void {
		super.destroy()

		this.deps.events.off('presetDrawn', this.#updateLastRender)
	}

	#updateLastRender = (controlId: string, render: ImageResult): void => {
		if (controlId !== this.controlId) return
		this.#lastRender = render
	}

	/**
	 * Get the size of the bitmap render of this control
	 */
	getBitmapSize(): { width: number; height: number } | null {
		return GetButtonBitmapSize(this.deps.userconfig, this.#baseStyle)
	}

	/**
	 * Get the complete style object of a button
	 * @returns the processed style of the button
	 */
	getDrawStyle(): DrawStyleButtonModel {
		const style = this.entities.getUnparsedFeedbackStyle(this.#baseStyle)

		if (style.text) {
			// Block out the button text
			const overrideVariableValues: CompanionVariableValues = {}

			const location = this.deps.pageStore.getLocationOfControlId(this.controlId)
			if (location) {
				// Ensure we don't enter into an infinite loop
				overrideVariableValues[`$(internal:b_text_${location.pageNumber}_${location.row}_${location.column})`] = '$RE'
			}

			// Setup the parser
			const parser = this.deps.variables.values.createVariablesAndExpressionParser(
				location,
				this.entities.getLocalVariableEntities(),
				overrideVariableValues
			)

			if (style.textExpression) {
				const parseResult = parser.executeExpression(style.text, undefined)
				if (parseResult.ok) {
					style.text = parseResult.value + ''
				} else {
					this.logger.error(`Expression parse error: ${parseResult.error}`)
					style.text = 'ERR'
				}
				this.#last_draw_variables = parseResult.variableIds.size > 0 ? parseResult.variableIds : null
			} else {
				const parseResult = parser.parseVariables(style.text)
				style.text = parseResult.text
				this.#last_draw_variables = parseResult.variableIds.size > 0 ? parseResult.variableIds : null
			}
		}

		return {
			cloud: false,
			cloud_error: false,

			...cloneDeep(style),

			...omit(this.getDrawStyleButtonStateProps(), ['cloud', 'cloud_error']),

			style: 'button',
		}
	}

	/**
	 * Collect the instance ids, labels, and variables referenced by this control
	 * @param foundConnectionIds - instance ids being referenced
	 * @param foundConnectionLabels - instance labels being referenced
	 * @param foundVariables - variables being referenced
	 */
	collectReferencedConnectionsAndVariables(
		foundConnectionIds: Set<string>,
		foundConnectionLabels: Set<string>,
		foundVariables: Set<string>
	): void {
		new VisitorReferencesCollector(this.deps.internalModule, foundConnectionIds, foundConnectionLabels, foundVariables)
			.visitButtonDrawStlye(this.#baseStyle)
			.visitEntities(this.entities.getAllEntities(), [])
	}

	/**
	 * Rename a connection for variables used in this control
	 * @param labelFrom - the old connection short name
	 * @param labelTo - the new connection short name
	 */
	renameVariables(labelFrom: string, labelTo: string): void {
		const allEntities = this.entities.getAllEntities()

		// Fix up references
		const changed = new VisitorReferencesUpdater(this.deps.internalModule, { [labelFrom]: labelTo }, undefined)
			.visitButtonDrawStlye(this.#baseStyle)
			.visitEntities(allEntities, [])
			.recheckChangedFeedbacks()
			.hasChanges()

		// redraw if needed and save changes
		this.commitChange(changed)
	}

	/**
	 * Propagate variable changes
	 * @param allChangedVariables - variables with changes
	 */
	onVariablesChanged(allChangedVariables: Set<string>): void {
		this.entities.stepCheckExpressionOnVariablesChanged(allChangedVariables)

		if (this.#last_draw_variables) {
			for (const variable of allChangedVariables.values()) {
				if (this.#last_draw_variables.has(variable)) {
					this.logger.silly('variable changed in button ' + this.controlId)

					this.triggerRedraw()
					return
				}
			}
		}
	}

	/**
	 * Update the style fields of this control
	 * @param diff - config diff to apply
	 * @returns true if any changes were made
	 */
	styleSetFields(_diff: Record<string, any>): boolean {
		throw new Error('ControlButtonPreset does not support mutations')
	}

	/**
	 * Convert this control to JSON
	 * To be sent to the client and written to the db
	 * @param clone - Whether to return a cloned object
	 */
	override toJSON(clone = true): PresetButtonModel {
		const obj: PresetButtonModel = {
			type: this.type,
			style: this.#baseStyle,
			options: this.options,
			feedbacks: this.entities.getFeedbackEntities(),
			steps: this.entities.asNormalButtonSteps(),
			localVariables: this.entities.getLocalVariableEntities().map((ent) => ent.asEntityModel(true)),
		}

		return clone ? cloneDeep(obj) : obj
	}

	/**
	 * Get any volatile properties for the control
	 */
	override toRuntimeJSON(): NormalButtonRuntimeProps {
		return {
			current_step_id: this.entities.currentStepId,
		}
	}

	// /**
	//  * Trigger a redraw of this control, if it can be drawn
	//  */
	// triggerRedraw = debounceFn(
	// 	() => {
	// 		// This is a hacky way of ensuring we don't schedule two invalidations in short succession when doing lots of work
	// 		// Long term this should be replaced with a proper work queue inside GraphicsController
	// 		if (this.#pendingDraw) return

	// 		this.#pendingDraw = true
	// 		setImmediate(() => {
	// 			this.deps.events.emit('invalidateControlRender', this.controlId)
	// 			this.#pendingDraw = false
	// 		})
	// 	},
	// 	{
	// 		before: false,
	// 		after: true,
	// 		wait: 10,
	// 		maxWait: 20,
	// 	}
	// )
	// #pendingDraw = false
}
