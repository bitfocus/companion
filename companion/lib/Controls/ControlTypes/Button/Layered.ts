import { ButtonControlBase } from './Base.js'
import { cloneDeep } from 'lodash-es'
import type {
	ControlWithActionSets,
	ControlWithActions,
	ControlWithLayeredStyle,
	ControlWithoutEvents,
	ControlWithoutStyle,
} from '../../IControlFragments.js'
import { VisitorReferencesUpdater } from '../../../Resources/Visitors/ReferencesUpdater.js'
import { VisitorReferencesCollector } from '../../../Resources/Visitors/ReferencesCollector.js'
import type { LayeredButtonModel, LayeredButtonOptions } from '@companion-app/shared/Model/ButtonModel.js'
import type { ControlDependencies } from '../../ControlDependencies.js'
import type { ControlActionSetAndStepsManager } from '../../Entities/ControlActionSetAndStepsManager.js'
import {
	ButtonGraphicsDecorationType,
	ButtonGraphicsElementUsage,
	ButtonGraphicsGroupElement,
	ExpressionOrValue,
	SomeButtonGraphicsElement,
} from '@companion-app/shared/Model/StyleLayersModel.js'
import { ButtonStyleProperties, DrawStyleLayeredButtonModel } from '@companion-app/shared/Model/StyleModel.js'
import { CreateElementOfType } from './LayerDefaults.js'
import { ConvertSomeButtonGraphicsElementForDrawing } from '@companion-app/shared/Graphics/ConvertGraphicsElements.js'
import { CompanionVariableValues } from '@companion-module/base'

/**
 * Class for the button control with layer based rendering.
 *
 * @author Julian Waller <me@julusian.co.uk>
 * @since 4.0.0
 * @copyright 2025 Bitfocus AS
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
	extends ButtonControlBase<LayeredButtonModel, LayeredButtonOptions>
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
			usage: ButtonGraphicsElementUsage.Automatic,
			type: 'canvas',
			decoration: { value: ButtonGraphicsDecorationType.FollowDefault, isExpression: false },
		},
		{
			id: 'box0',
			name: 'Background',
			usage: ButtonGraphicsElementUsage.Automatic,
			type: 'box',
			enabled: { value: true, isExpression: false },
			opacity: { value: 100, isExpression: false },
			x: { value: 0, isExpression: false },
			y: { value: 0, isExpression: false },
			width: { value: 1, isExpression: false },
			height: { value: 1, isExpression: false },
			color: { value: 0x000000, isExpression: false },
		},
		{
			id: 'text0',
			name: 'Text',
			usage: ButtonGraphicsElementUsage.Automatic,
			type: 'text',
			enabled: { value: true, isExpression: false },
			opacity: { value: 100, isExpression: false },
			x: { value: 0, isExpression: false },
			y: { value: 0, isExpression: false },
			width: { value: 1, isExpression: false },
			height: { value: 1, isExpression: false },
			text: { value: '', isExpression: false },
			color: { value: 0xffffff, isExpression: false },
			halign: { value: 'center', isExpression: false },
			valign: { value: 'center', isExpression: false },
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
			canModifyStyleInApis: false,
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

			// HACK: temporary fill in new properties
			for (const element of this.#drawElements) {
				if (element.type !== 'canvas') {
					const defaults = CreateElementOfType(element.type)
					for (const key of Object.keys(defaults)) {
						if (key === 'id' || key === 'type' || key === 'name') continue
						if (!(key in element)) {
							;(element as any)[key] = (defaults as any)[key]
						}
					}
				}
				// switch (element.type) {
				// 	case 'image':
				// 		element.fillMode = element.fillMode || { value: 'fit_or_shrink', isExpression: false }
				// 		element.enabled = element.enabled || { value: true, isExpression: false }
				// 		break
				// 	case 'text':
				// 		element.enabled = element.enabled || { value: true, isExpression: false }
				// 		break
				// }
			}

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

	#lastDrawStyle: DrawStyleLayeredButtonModel | null = null
	getLastDrawStyle(): DrawStyleLayeredButtonModel | null {
		return this.#lastDrawStyle
	}

	/**
	 * Get the complete style object of a button
	 * @returns the processed style of the button
	 */
	async getDrawStyle(): Promise<DrawStyleLayeredButtonModel | null> {
		// Block out the button text
		const injectedVariableValues: CompanionVariableValues = {}
		const location = this.deps.page.getLocationOfControlId(this.controlId)
		if (location) {
			// Ensure we don't enter into an infinite loop
			// TODO - legacy location variables?
			// injectedVariableValues[`$(internal:b_text_${location.pageNumber}_${location.row}_${location.column})`] = '$RE'
		}

		const parser = this.deps.variables.values.createVariablesAndExpressionParser(
			location,
			this.entities.getLocalVariableEntities(),
			injectedVariableValues
		)

		// Compute the new drawing
		const { elements, usedVariables } = await ConvertSomeButtonGraphicsElementForDrawing(
			this.#drawElements,
			async (str: string, requiredType?: string) => parser.executeExpression(str, requiredType),
			async (str: string) => {
				const res = parser.parseVariables(str)
				return {
					ok: true,
					value: res.text,
					variableIds: res.variableIds,
				}
			},
			true
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

		new VisitorReferencesCollector(this.deps.internalModule, foundConnectionIds, foundConnectionLabels)
			.visitEntities(allEntities, [])
			.visitDrawElements(this.#drawElements)
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
		const currentElementLocation = this.#findElementIndexAndParent(this.#drawElements, null, id)
		if (!currentElementLocation) return false

		const { indexOfElement, currentParentElementArray } = currentElementLocation

		currentParentElementArray.splice(indexOfElement, 1)

		// Save change and redraw
		this.commitChange(true)

		return true
	}

	layeredStyleSetElementName(id: string, name: string): boolean {
		const currentElementLocation = this.#findElementIndexAndParent(this.#drawElements, null, id)
		if (!currentElementLocation) return false

		const { element } = currentElementLocation

		element.name = name

		// Save change without a redraw
		this.commitChange(false)

		return true
	}

	layeredStyleSetElementUsage(id: string, usage: ButtonGraphicsElementUsage): boolean {
		const currentElementLocation = this.#findElementIndexAndParent(this.#drawElements, null, id)
		if (!currentElementLocation) return false

		const { element } = currentElementLocation

		element.usage = usage

		// Trigger a redraw, as this could affect listeners of the properties
		this.commitChange(true)

		return true
	}

	#findElementIndexAndParent(
		searchInElements: SomeButtonGraphicsElement[],
		parentId: string | null,
		searchId: string
	): {
		indexOfElement: number
		element: SomeButtonGraphicsElement
		currentParentElementId: string | null
		currentParentElementArray: SomeButtonGraphicsElement[]
	} | null {
		const indexOfElement = searchInElements.findIndex((element) => element.id === searchId)
		if (indexOfElement !== -1)
			return {
				indexOfElement: indexOfElement,
				element: searchInElements[indexOfElement],
				currentParentElementId: parentId,
				currentParentElementArray: searchInElements,
			}

		for (const element of searchInElements) {
			if (element.type !== 'group') continue

			const result = this.#findElementIndexAndParent(element.children, element.id, searchId)
			if (result) return result
		}

		return null
	}
	#findGroupElementById(
		searchInElements: SomeButtonGraphicsElement[],
		searchId: string
	): ButtonGraphicsGroupElement | null {
		for (const element of searchInElements) {
			if (element.type !== 'group') continue

			if (element.id === searchId) return element
			const result = this.#findGroupElementById(element.children, searchId)
			if (result) return result
		}

		return null
	}

	layeredStyleMoveElement(id: string, parentElementId: string | null, newIndex: number): boolean {
		const currentElementLocation = this.#findElementIndexAndParent(this.#drawElements, null, id)
		if (!currentElementLocation) return false
		const { indexOfElement, currentParentElementId, currentParentElementArray } = currentElementLocation

		// Can't move to or from the first element
		if ((indexOfElement === 0 && currentParentElementId === null) || (newIndex === 0 && parentElementId === null))
			return false

		const targetElementArray = parentElementId
			? this.#findGroupElementById(this.#drawElements, parentElementId)?.children
			: this.#drawElements

		// Make sure the target parent exists
		if (!targetElementArray) return false

		if (newIndex < 0 || newIndex > targetElementArray.length) return false

		const element = currentParentElementArray.splice(indexOfElement, 1)[0]
		targetElementArray.splice(newIndex, 0, element)

		// Save change and redraw
		this.commitChange(true)

		return true
	}

	layeredStyleUpdateOptionValue(id: string, key: string, value: any): boolean {
		// Ignore some fixed properties
		if (key === 'id' || key === 'type' || key === 'name') return false

		// Find the element
		const currentElementLocation = this.#findElementIndexAndParent(this.#drawElements, null, id)
		if (!currentElementLocation) return false

		const { element } = currentElementLocation

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
		const currentElementLocation = this.#findElementIndexAndParent(this.#drawElements, null, id)
		if (!currentElementLocation) return false

		const { element } = currentElementLocation

		// Fetch the property wrapper
		const elementEntry = (element as any)[key] as ExpressionOrValue<any>
		if (!elementEntry) return false

		if (!elementEntry.isExpression && value) {
			// Make sure the value is expression safe
			if (element.type === 'text' && key === 'text') {
				// Skip, this is very hard to fixup perfectly
			} else if (typeof elementEntry.value === 'string') {
				// If its a string, it will need to be wrapped in quotes
				// This is not always good enough, but is better than nothing
				elementEntry.value = `'${elementEntry.value}'`
			} else if (typeof elementEntry.value === 'number' && key === 'color') {
				// If its a color number, it is nicer to have it as a hex string
				elementEntry.value = '0x' + elementEntry.value.toString(16)
			} else if (typeof elementEntry.value === 'boolean') {
				elementEntry.value = elementEntry.value ? 'true' : 'false'
			}
			// Future: this may want more cases
		} else if (elementEntry.isExpression && !value) {
			// Preserve current resolved value
			const lastDrawStyle = this.getLastDrawStyle()
			const lastDrawElement = lastDrawStyle?.elements.find((el) => el.id === id)

			if (key === 'enabled' && !lastDrawElement) {
				// Special case, element was presumably disabled
				elementEntry.value = false as any
			} else if (lastDrawElement) {
				// The element was found, copy the value
				elementEntry.value = lastDrawElement[key as keyof typeof lastDrawElement]
			}
		}

		// Update the value
		elementEntry.isExpression = value

		// Save change and redraw
		this.commitChange(true)

		return true
	}

	layeredStyleUpdateFromLegacyProperties(diff: Partial<ButtonStyleProperties>): boolean {
		if (!this.options.canModifyStyleInApis) return false

		// TODO
		return false
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
			.visitEntities(allEntities, [])
			.visitDrawElements(this.#drawElements)
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
