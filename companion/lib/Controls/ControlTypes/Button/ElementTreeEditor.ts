import { nanoid } from 'nanoid'
import type { JsonValue } from 'type-fest'
import { getDefaultPinnedProperties } from '@companion-app/shared/Graphics/ElementPropertiesSchemas.js'
import type { ExpressionOrValue } from '@companion-app/shared/Model/Options.js'
import type {
	ButtonGraphicsGroupElement,
	SomeButtonGraphicsElement,
} from '@companion-app/shared/Model/StyleLayersModel.js'
import { ButtonGraphicsElementUsage, type CompositeElementOptionKey } from '@companion-app/shared/Model/StyleModel.js'
import type { CompositeElementDefinition } from '../../../Instance/Definitions.js'
import { CreateElementOfType } from './LayerDefaults.js'
import { cloneElementWithNewIds } from './LayerUtils.js'

/**
 * What an {@link ElementTreeEditor} needs from the owner of the elements it edits
 */
export interface ElementTreeEditorHost {
	/** The top level elements, which are edited in place */
	readonly elements: SomeButtonGraphicsElement[]
	/**
	 * Whether the first top level element is the canvas, which is fixed in place. Elements which aren't drawn on a
	 * canvas of their own (eg those of a custom element) have none. A canvas can never be added
	 */
	readonly hasCanvas: boolean

	/** The definition of a composite element, or undefined if there is none */
	getCompositeElementDefinition(connectionId: string, elementId: string): CompositeElementDefinition | undefined
	/** Whether a composite element can be added, so that one which would draw itself is refused */
	canAddCompositeElement(connectionId: string, elementId: string): boolean

	/** An element has changed, so whatever was drawn from it must be drawn again */
	invalidateElement(elementId: string): void
	commitChange(redraw: boolean): void
	emitElementChanged(elementId: string): void
}

/**
 * A located element within a tree of elements
 */
export interface ElementLocation {
	indexOfElement: number
	element: SomeButtonGraphicsElement
	currentParentElementId: string | null
	currentParentElementArray: SomeButtonGraphicsElement[]
}

/**
 * The editing operations (add / remove / duplicate / move / rename / reusage / pin / option) of a tree of elements,
 * shared by the layered button and the custom element. Each mutator changes the elements of the host in place, then
 * tells the host what changed.
 */
export class ElementTreeEditor {
	readonly #host: ElementTreeEditorHost

	constructor(host: ElementTreeEditorHost) {
		this.#host = host
	}

	/**
	 * Create an element, to be added
	 * @param type The type of the element, or `<connectionId>;<elementId>` for a composite element
	 */
	#createElement(type: string): SomeButtonGraphicsElement {
		// A composite element contains a semicolon
		if (!type.includes(';')) return CreateElementOfType(type as SomeButtonGraphicsElement['type'])

		const [connectionId, elementId] = type.split(';', 2)
		const compositeDefinition = this.#host.getCompositeElementDefinition(connectionId, elementId)
		if (!compositeDefinition) throw new Error(`Composite element not found: ${type}`)
		if (!this.#host.canAddCompositeElement(connectionId, elementId))
			throw new Error(`Composite element cannot be added here, as it would draw itself: ${type}`)

		const newElement: SomeButtonGraphicsElement = {
			id: nanoid(),
			name: compositeDefinition.name,
			usage: ButtonGraphicsElementUsage.Automatic,
			type: 'composite',
			connectionId,
			elementId,
			pinnedProperties: getDefaultPinnedProperties('composite'),
			enabled: { value: true, isExpression: false },
			opacity: { value: 100, isExpression: false },
			x: { value: 0, isExpression: false },
			y: { value: 0, isExpression: false },
			width: { value: 100, isExpression: false },
			height: { value: 100, isExpression: false },
			rotation: { value: 0, isExpression: false },
		}

		for (const field of compositeDefinition.options) {
			newElement[`opt:${field.id}`] = {
				value: 'default' in field ? field.default : undefined,
				isExpression: false,
			}
		}

		return newElement
	}

	addElement(type: string, afterElementId: string | null): string {
		const newElement = this.#createElement(type)

		// Insert immediately above the given element. Falls back to the top of the
		// top-level stack when there is no such element (e.g. nothing selected).
		const insertAfter = afterElementId ? this.findElement(afterElementId) : null
		if (insertAfter) {
			insertAfter.currentParentElementArray.splice(insertAfter.indexOfElement + 1, 0, newElement)
		} else {
			this.#host.elements.push(newElement)
		}

		this.#host.invalidateElement(newElement.id)
		this.#host.commitChange(true)
		this.#host.emitElementChanged(newElement.id)

		return newElement.id
	}

	removeElement(id: string): boolean {
		const currentElementLocation = this.findElement(id)
		if (!currentElementLocation) return false

		const { indexOfElement, element, currentParentElementArray } = currentElementLocation

		// Canvas is the fixed background element and cannot be removed
		if (element.type === 'canvas') return false

		currentParentElementArray.splice(indexOfElement, 1)

		this.#host.invalidateElement(id)
		this.#host.commitChange(true)
		this.#host.emitElementChanged(id)

		return true
	}

	duplicateElement(id: string): string | false {
		const currentElementLocation = this.findElement(id)
		if (!currentElementLocation) return false

		const { indexOfElement, element, currentParentElementArray } = currentElementLocation

		// Canvas is the fixed background element and cannot be duplicated
		if (element.type === 'canvas') return false

		const clone = cloneElementWithNewIds(element)

		currentParentElementArray.splice(indexOfElement + 1, 0, clone)

		this.#host.invalidateElement(clone.id)
		this.#host.commitChange(true)
		this.#host.emitElementChanged(clone.id)

		return clone.id
	}

	setElementName(id: string, name: string): boolean {
		const currentElementLocation = this.findElement(id)
		if (!currentElementLocation) return false

		currentElementLocation.element.name = name

		this.#host.commitChange(false)

		return true
	}

	setElementUsage(id: string, usage: ButtonGraphicsElementUsage): boolean {
		const currentElementLocation = this.findElement(id)
		if (!currentElementLocation) return false

		currentElementLocation.element.usage = usage

		// Trigger a redraw, as this could affect listeners of the properties
		this.#host.commitChange(true)

		return true
	}

	/**
	 * Pin or unpin one property of an element, so it does (or no longer does) appear in the pinned view. The stored
	 * order is insertion order and carries no meaning: the pinned view lays properties out in the element type's
	 * canonical schema order.
	 */
	setElementPropertyPinned(id: string, property: string, pinned: boolean): boolean {
		const currentElementLocation = this.findElement(id)
		if (!currentElementLocation) return false

		const { element } = currentElementLocation
		// The canvas holds button-level properties, which are out of scope for pinning
		if (element.type === 'canvas') return false

		if (element.pinnedProperties.includes(property) === pinned) return false // Already in the wanted state

		if (pinned) {
			element.pinnedProperties.push(property)
		} else {
			element.pinnedProperties = element.pinnedProperties.filter((pinnedProperty) => pinnedProperty !== property)
		}

		// Pins are editor-only metadata, so nothing needs redrawing
		this.#host.commitChange(false)

		return true
	}

	getElementById(id: string): SomeButtonGraphicsElement | undefined {
		return this.findElement(id)?.element
	}

	moveElement(id: string, parentElementId: string | null, newIndex: number): boolean {
		const currentElementLocation = this.findElement(id)
		if (!currentElementLocation) return false
		const { indexOfElement, currentParentElementId, currentParentElementArray } = currentElementLocation

		// Can't move the canvas, or anything in front of it
		if (
			this.#host.hasCanvas &&
			((indexOfElement === 0 && currentParentElementId === null) || (newIndex === 0 && parentElementId === null))
		)
			return false

		// Cycle detection: prevent moving an element into itself or one of its own descendants
		if (parentElementId !== null) {
			if (parentElementId === id) return false
			const { element } = currentElementLocation
			if (element.type === 'group' && findGroupElementById(element.children, parentElementId) !== null) return false
		}

		const targetElementArray = parentElementId
			? findGroupElementById(this.#host.elements, parentElementId)?.children
			: this.#host.elements

		if (!targetElementArray) return false
		if (newIndex < 0 || newIndex > targetElementArray.length) return false

		const element = currentParentElementArray.splice(indexOfElement, 1)[0]
		targetElementArray.splice(newIndex, 0, element)

		this.#host.commitChange(true)
		// Moving into or out of a group changes the element's layout
		this.#host.emitElementChanged(id)

		return true
	}

	// Fixed/structural properties, which must never be reassigned via the generic option setters as it
	// would corrupt the layer model
	static #isStructuralKey(key: string): boolean {
		return (
			key === 'id' ||
			key === 'type' ||
			key === 'name' ||
			key === 'usage' ||
			key === 'pinnedProperties' ||
			key === 'children' ||
			key === 'connectionId' ||
			key === 'elementId'
		)
	}

	updateOption(id: string, key: string, newVal: ExpressionOrValue<JsonValue | undefined>): boolean {
		return this.updateOptions(id, { [key]: newVal })
	}

	/**
	 * Apply several option changes to an element as a single commit. Callers changing more than one key at
	 * once (eg a drag that moves and resizes) should use this rather than repeated {@link updateOption}, so
	 * the element is never persisted or redrawn in a partially-updated state.
	 */
	updateOptions(id: string, values: Record<string, ExpressionOrValue<JsonValue | undefined>>): boolean {
		const entries = Object.entries(values).filter(([key]) => !ElementTreeEditor.#isStructuralKey(key))
		if (entries.length === 0) return false

		const currentElementLocation = this.findElement(id)
		if (!currentElementLocation) return false

		const entry = currentElementLocation.element as any

		for (const [key, newVal] of entries) {
			entry[key] = newVal
		}

		this.#host.invalidateElement(id)
		this.#host.commitChange(true)
		this.#host.emitElementChanged(id)

		return true
	}

	/**
	 * Rename or remove the value of an option of every use of a composite element, after the option has been renamed or
	 * removed from it, so that each keeps its value, or a new option with the same id doesn't pick it up
	 * @param connectionId The connection of the composite element
	 * @param elementId The id of the composite element
	 * @param fromKey The old key of the option
	 * @param toKey The new key of the option, or null if it was removed
	 * @returns Whether any element was changed
	 */
	renameCompositeOption(
		connectionId: string,
		elementId: string,
		fromKey: CompositeElementOptionKey,
		toKey: CompositeElementOptionKey | null
	): boolean {
		const changedIds: string[] = []
		const visit = (elements: SomeButtonGraphicsElement[]): void => {
			for (const element of elements) {
				if (element.type === 'group') {
					visit(element.children)
				} else if (
					element.type === 'composite' &&
					element.connectionId === connectionId &&
					element.elementId === elementId &&
					fromKey in element
				) {
					const value = element[fromKey]
					delete element[fromKey]
					if (toKey) element[toKey] = value
					changedIds.push(element.id)
				}
			}
		}
		visit(this.#host.elements)

		if (changedIds.length === 0) return false

		for (const id of changedIds) this.#host.invalidateElement(id)
		this.#host.commitChange(true)
		for (const id of changedIds) this.#host.emitElementChanged(id)

		return true
	}

	/**
	 * Find an element anywhere in the tree, with where it is
	 */
	findElement(searchId: string): ElementLocation | null {
		return findElementIndexAndParent(this.#host.elements, null, searchId)
	}
}

function findElementIndexAndParent(
	searchInElements: SomeButtonGraphicsElement[],
	parentId: string | null,
	searchId: string
): ElementLocation | null {
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

		const result = findElementIndexAndParent(element.children, element.id, searchId)
		if (result) return result
	}

	return null
}

function findGroupElementById(
	searchInElements: SomeButtonGraphicsElement[],
	searchId: string
): ButtonGraphicsGroupElement | null {
	for (const element of searchInElements) {
		if (element.type !== 'group') continue

		if (element.id === searchId) return element
		const result = findGroupElementById(element.children, searchId)
		if (result) return result
	}

	return null
}
