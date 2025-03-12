import { ButtonControlBase } from './Base.js'
import { cloneDeep, omit } from 'lodash-es'
import { VisitorReferencesCollector } from '../../../Resources/Visitors/ReferencesCollector.js'
import type {
	ControlWithActionSets,
	ControlWithActions,
	ControlWithStyle,
	ControlWithoutEvents,
} from '../../IControlFragments.js'
import { ReferencesVisitors } from '../../../Resources/Visitors/ReferencesVisitors.js'
import type { NormalButtonModel, NormalButtonOptions } from '@companion-app/shared/Model/ButtonModel.js'
import type { ButtonStyleProperties, DrawStyleButtonModel } from '@companion-app/shared/Model/StyleModel.js'
import type { ControlDependencies } from '../../ControlDependencies.js'
import { EntityModelType } from '@companion-app/shared/Model/EntityModel.js'
import type { ControlActionSetAndStepsManager } from '../../Entities/ControlActionSetAndStepsManager.js'
import { GetButtonBitmapSize } from '../../../Resources/Util.js'
import type { CompanionVariableValues } from '@companion-module/base'
import type { VariableUpdateReason } from '../../../Variables/Values.js'

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
	implements ControlWithStyle, ControlWithActions, ControlWithoutEvents, ControlWithActionSets
{
	readonly type = 'button'

	/**
	 * The defaults style for a button
	 */
	static DefaultStyle: ButtonStyleProperties = {
		text: '',
		textExpression: false,
		size: 'auto',
		png64: null,
		alignment: 'center:center',
		pngalignment: 'center:center',
		color: 0xffffff,
		bgcolor: 0x000000,
		show_topbar: 'default',
	}

	readonly supportsActions = true
	readonly supportsEvents = false
	readonly supportsActionSets = true
	readonly supportsStyle = true
	readonly supportsLayeredStyle = false

	/**
	 * The variabls referenced in the last draw. Whenever one of these changes, a redraw should be performed
	 */
	#last_draw_variables: Set<string> | null = null

	/**
	 * The base style without feedbacks applied
	 */
	#baseStyle: ButtonStyleProperties = cloneDeep(ControlButtonNormal.DefaultStyle)

	get baseStyle(): ButtonStyleProperties {
		return this.#baseStyle
	}

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

			this.#baseStyle = Object.assign(this.#baseStyle, storage.style || {})
			this.options = Object.assign(this.options, storage.options || {})
			this.entities.setupRotaryActionSets(!!this.options.rotaryActions, true)
			this.entities.loadStorage(storage, true, isImport)

			// Ensure control is stored before setup
			if (isImport) setImmediate(() => this.postProcessImport())
		}
	}

	/**
	 * Prepare this control for deletion
	 */
	destroy(): void {
		super.destroy()
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
		let style = this.entities.getUnparsedFeedbackStyle(this.#baseStyle)

		if (style.text) {
			// Block out the button text
			const overrideVariableValues: CompanionVariableValues = {}

			const location = this.deps.page.getLocationOfControlId(this.controlId)
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

		ReferencesVisitors.visitControlReferences(this.deps.internalModule, visitor, this.#baseStyle, [], allEntities, [])
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
			this.#baseStyle,
			[],
			allEntities,
			[],
			true
		)

		// redraw if needed and save changes
		this.commitChange(changed)
	}

	/**
	 * Propagate variable changes
	 * @param allChangedVariables - variables with changes
	 */
	onVariablesChanged(allChangedVariables: Map<string, VariableUpdateReason>): void {
		// console.log('change', allChangedVariables)
		if (this.#last_draw_variables) {
			for (const variable of allChangedVariables.keys()) {
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
			Object.assign(this.#baseStyle, diff)

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

	/**
	 * Convert this control to JSON
	 * To be sent to the client and written to the db
	 * @param clone - Whether to return a cloned object
	 */
	override toJSON(clone = true): NormalButtonModel {
		const obj: NormalButtonModel = {
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
	override toRuntimeJSON() {
		return {
			current_step_id: this.entities.currentStepId,
		}
	}
}
