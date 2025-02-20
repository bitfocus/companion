import { ButtonControlBase } from './Base.js'
import { cloneDeep } from 'lodash-es'
import { VisitorReferencesCollector } from '../../../Resources/Visitors/ReferencesCollector.js'
import type {
	ControlWithActionSets,
	ControlWithActions,
	ControlWithLayeredStyle,
	ControlWithoutEvents,
	ControlWithoutStyle,
} from '../../IControlFragments.js'
import { ReferencesVisitors } from '../../../Resources/Visitors/ReferencesVisitors.js'
import type { LayeredButtonModel, NormalButtonOptions } from '@companion-app/shared/Model/ButtonModel.js'
import type { ControlDependencies } from '../../ControlDependencies.js'
import type { ControlActionSetAndStepsManager } from '../../Entities/ControlActionSetAndStepsManager.js'
import {
	ButtonGraphicsDecorationType,
	ExpressionOrValue,
	SomeButtonGraphicsElement,
} from '@companion-app/shared/Model/StyleLayersModel.js'
import { DrawStyleLayeredButtonModel, DrawStyleModel } from '@companion-app/shared/Model/StyleModel.js'
import { CreateElementOfType } from './LayerDefaults.js'
import { ConvertSomeButtonGraphicsElementForDrawing } from '@companion-app/shared/Graphics/ConvertGraphicsElements.js'
import { CompanionVariableValues } from '@companion-module/base'

/**
 * Class for the button control with layer based rendering.
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
export class ControlButtonLayered
	extends ButtonControlBase<LayeredButtonModel, NormalButtonOptions>
	implements
		ControlWithoutStyle,
		ControlWithLayeredStyle,
		ControlWithActions,
		ControlWithoutEvents,
		ControlWithActionSets
{
	readonly type = 'button-layered'

	/**
	 * The defaults style for a button
	 */
	static DefaultElements: SomeButtonGraphicsElement[] = [
		{
			id: 'canvas',
			name: 'Canvas',
			type: 'canvas',
			color: { value: 0x000000, isExpression: false },
			decoration: { value: ButtonGraphicsDecorationType.FollowDefault, isExpression: false },
		},
		{
			id: 'text0',
			name: 'Text',
			type: 'text',
			text: { value: '', isExpression: false },
			color: { value: 0xffffff, isExpression: false },
			alignment: { value: 'center:center', isExpression: false },
			fontsize: { value: 'auto', isExpression: false },
		},
	]

	readonly supportsActions = true
	readonly supportsEvents = false
	readonly supportsActionSets = true
	readonly supportsStyle = false
	readonly supportsLayeredStyle = true

	/**
	 * The variabls referenced in the last draw. Whenever one of these changes, a redraw should be performed
	 */
	#last_draw_variables: Set<string> | null = null

	/**
	 * The base style without feedbacks applied
	 */
	#drawElements: SomeButtonGraphicsElement[] = cloneDeep(ControlButtonLayered.DefaultElements)

	get actionSets(): ControlActionSetAndStepsManager {
		return this.entities
	}

	constructor(deps: ControlDependencies, controlId: string, storage: LayeredButtonModel | null, isImport: boolean) {
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
			if (storage.type !== 'button-layered')
				throw new Error(`Invalid type given to ControlButtonLayered: "${storage.type}"`)

			this.#drawElements = storage.style.layers || this.#drawElements
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
	getBitmapFeedbackSize(): { width: number; height: number } | null {
		// TODO-layered: implement this
		return null
		// return GetButtonBitmapSize(this.deps.userconfig, this.#baseStyle)
	}

	#lastDrawStyle: DrawStyleModel | null = null
	getLastDrawStyle(): DrawStyleModel | null {
		return this.#lastDrawStyle
	}

	/**
	 * Get the complete style object of a button
	 * @returns the processed style of the button
	 */
	async getDrawStyle(): Promise<DrawStyleModel | null> {
		// Block out the button text
		const injectedVariableValues: CompanionVariableValues = {}
		const location = this.deps.page.getLocationOfControlId(this.controlId)
		if (location) {
			// Ensure we don't enter into an infinite loop
			// TODO - legacy location variables?
			// injectedVariableValues[`$(internal:b_text_${location.pageNumber}_${location.row}_${location.column})`] = '$RE'
		}

		// TODO-layered inject any new local variables
		const executeExpression = async (str: string, requiredType?: string) =>
			this.deps.variables.values.executeExpression(str, location, requiredType, injectedVariableValues)

		// Compute the new drawing
		const { elements, usedVariables } = await ConvertSomeButtonGraphicsElementForDrawing(
			this.#drawElements,
			executeExpression
		)
		this.#last_draw_variables = usedVariables.size > 0 ? usedVariables : null

		const result: DrawStyleLayeredButtonModel = {
			...this.getDrawStyleButtonStateProps(),

			elements,

			style: 'button-layered',
		}

		this.#lastDrawStyle = result
		return result
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

		ReferencesVisitors.visitControlReferences(this.deps.internalModule, visitor, undefined, [], allEntities, [])
	}

	layeredStyleAddElement(type: string, index: number | null): string {
		const newElement = CreateElementOfType(type as SomeButtonGraphicsElement['type'])

		if (typeof index === 'number' && index >= 0 && index < this.#drawElements.length) {
			this.#drawElements.splice(index, 0, newElement)
		} else {
			this.#drawElements.push(newElement)
		}

		// Save change and redraw
		this.commitChange(true)

		return newElement.id
	}

	layeredStyleRemoveElement(id: string): boolean {
		const indexOfElement = this.#drawElements.findIndex((element) => element.id === id)
		if (indexOfElement === -1) return false

		this.#drawElements.splice(indexOfElement, 1)

		// Save change and redraw
		this.commitChange(true)

		return true
	}

	layeredStyleSetElementName(id: string, name: string): boolean {
		const element = this.#drawElements.find((element) => element.id === id)
		if (!element) return false

		element.name = name

		// Save change without a redraw
		this.commitChange(false)

		return true
	}

	layeredStyleMoveElement(id: string, newIndex: number): boolean {
		const indexOfElement = this.#drawElements.findIndex((element) => element.id === id)
		if (indexOfElement === -1) return false

		// Can't move to or from the first element
		if (indexOfElement === 0 || newIndex === 0) return false

		if (newIndex < 0 || newIndex >= this.#drawElements.length) return false

		const element = this.#drawElements.splice(indexOfElement, 1)[0]
		this.#drawElements.splice(newIndex, 0, element)

		// Save change and redraw
		this.commitChange(true)

		return true
	}

	layeredStyleUpdateOptionValue(id: string, key: string, value: any): boolean {
		// Ignore some fixed properties
		if (key === 'id' || key === 'type' || key === 'name') return false

		// Find the element
		const element = this.#drawElements.find((element) => element.id === id)
		if (!element) return false

		// Fetch the property wrapper
		const elementEntry = (element as any)[key] as ExpressionOrValue<any>
		if (!elementEntry) return false

		// Update the value
		elementEntry.value = value

		// Save change and redraw
		this.commitChange(true)

		return true
	}

	layeredStyleUpdateOptionIsExpression(id: string, key: string, value: boolean): boolean {
		// Ignore some fixed properties
		if (key === 'id' || key === 'type' || key === 'name') return false

		// Find the element
		const element = this.#drawElements.find((element) => element.id === id)
		if (!element) return false

		// Fetch the property wrapper
		const elementEntry = (element as any)[key] as ExpressionOrValue<any>
		if (!elementEntry) return false

		if (!elementEntry.isExpression && value) {
			// Make sure the value is expression safe
			if (typeof elementEntry.value === 'string') {
				// If its a string, it will need to be wrapped in quotes
				elementEntry.value = `'${elementEntry.value}'`
				// TODO-layered is this good enough?
			} else if (typeof elementEntry.value === 'number' && key === 'color') {
				// If its a color number, it is nicer to have it as a hex string
				elementEntry.value = '0x' + elementEntry.value.toString(16)
			}
			// TODO-layered any mroe cases
		} else if (elementEntry.isExpression && !value) {
			// Preserve current resolved value
			// TODO-layered implement this
		}

		// Update the value
		elementEntry.isExpression = value

		// Save change and redraw
		this.commitChange(true)

		return true
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
			undefined,
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
	onVariablesChanged(allChangedVariables: Set<string>): void {
		if (!this.#last_draw_variables) return
		for (const variable of allChangedVariables.values()) {
			if (!this.#last_draw_variables.has(variable)) continue
			this.logger.silly('variable changed in button ' + this.controlId)

			this.triggerRedraw()
			return
		}
	}

	/**
	 * Convert this control to JSON
	 * To be sent to the client and written to the db
	 * @param clone - Whether to return a cloned object
	 */
	override toJSON(clone = true): LayeredButtonModel {
		const obj: LayeredButtonModel = {
			type: this.type,
			style: { layers: this.#drawElements },
			options: this.options,
			feedbacks: this.entities.getFeedbackEntities(),
			steps: this.entities.asNormalButtonSteps(),
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
