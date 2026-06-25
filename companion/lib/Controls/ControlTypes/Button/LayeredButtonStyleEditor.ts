import { nanoid } from 'nanoid'
import type { JsonValue } from 'type-fest'
import type { ExpressionOrValue } from '@companion-app/shared/Model/Options.js'
import type {
	ButtonGraphicsBoxElement,
	ButtonGraphicsElementBase,
	ButtonGraphicsGroupElement,
	ButtonGraphicsImageElement,
	ButtonGraphicsTextElement,
	SomeButtonGraphicsElement,
} from '@companion-app/shared/Model/StyleLayersModel.js'
import { ButtonGraphicsElementUsage, type ButtonStyleProperties } from '@companion-app/shared/Model/StyleModel.js'
import { ParseLegacyStyle } from '../../../Resources/ConvertLegacyStyleToElements.js'
import { lazy } from '../../../Resources/Util.js'
import type { ControlDependencies } from '../../ControlDependencies.js'
import { CreateElementOfType } from './LayerDefaults.js'
import { LayeredButtonDrawer, type LayeredButtonDrawerHost } from './LayeredButtonDrawer.js'
import { cloneElementWithNewIds } from './LayerUtils.js'

/**
 * The drawer host extended with the persistence callbacks the editing operations need.
 */
export interface LayeredButtonStyleEditorHost extends LayeredButtonDrawerHost {
	commitChange(redraw?: boolean): void
	emitElementChanged(elementId: string): void
}

/**
 * A {@link LayeredButtonDrawer} that additionally owns the layered-style **editing** operations (add / remove
 * / duplicate / move / rename / reusage / option / legacy-style). Composed only by the editable layered
 * button; read-only controls (e.g. the preset reference) compose the plain {@link LayeredButtonDrawer}, so
 * they have no way to mutate their style.
 *
 * Each mutator updates the elements and conversion cache owned by the base drawer, then `commitChange`s and
 * emits the element-changed event via the host.
 */
export class LayeredButtonStyleEditor extends LayeredButtonDrawer {
	readonly #host: LayeredButtonStyleEditorHost

	constructor(deps: ControlDependencies, controlId: string, host: LayeredButtonStyleEditorHost) {
		super(deps, controlId, host)
		this.#host = host
	}

	addElement(type: string, index: number | null): string {
		let newElement: SomeButtonGraphicsElement

		// Check if this is a composite element (contains semicolon)
		if (type.includes(';')) {
			const [connectionId, elementId] = type.split(';', 2)
			const compositeDefinition = this.deps.instance.definitions.getCompositeElementDefinition(connectionId, elementId)

			if (compositeDefinition) {
				newElement = {
					id: nanoid(),
					name: compositeDefinition.name,
					usage: ButtonGraphicsElementUsage.Automatic,
					type: 'composite',
					connectionId,
					elementId,
					enabled: { value: true, isExpression: false },
					opacity: { value: 100, isExpression: false },
					x: { value: 0, isExpression: false },
					y: { value: 0, isExpression: false },
					width: { value: 100, isExpression: false },
					height: { value: 100, isExpression: false },
				}

				for (const field of compositeDefinition.options) {
					newElement[`opt:${field.id}`] = {
						value: 'default' in field ? field.default : undefined,
						isExpression: false,
					}
				}
			} else {
				throw new Error(`Composite element not found: ${type}`)
			}
		} else {
			newElement = CreateElementOfType(type as SomeButtonGraphicsElement['type'])
		}

		if (typeof index === 'number' && index >= 0 && index < this.drawElementsList.length) {
			this.drawElementsList.splice(index, 0, newElement)
		} else {
			this.drawElementsList.push(newElement)
		}

		this.elementConversionCache.queueInvalidate(newElement.id)
		this.#host.commitChange(true)
		this.#host.emitElementChanged(newElement.id)

		return newElement.id
	}

	removeElement(id: string): boolean {
		const currentElementLocation = this.#findElementIndexAndParent(this.drawElementsList, null, id)
		if (!currentElementLocation) return false

		const { indexOfElement, element, currentParentElementArray } = currentElementLocation

		// Canvas is the fixed background element and cannot be removed
		if (element.type === 'canvas') return false

		currentParentElementArray.splice(indexOfElement, 1)

		this.elementConversionCache.queueInvalidate(id)
		this.#host.commitChange(true)
		this.#host.emitElementChanged(id)

		return true
	}

	duplicateElement(id: string): string | false {
		const currentElementLocation = this.#findElementIndexAndParent(this.drawElementsList, null, id)
		if (!currentElementLocation) return false

		const { indexOfElement, element, currentParentElementArray } = currentElementLocation

		// Canvas is the fixed background element and cannot be duplicated
		if (element.type === 'canvas') return false

		const clone = cloneElementWithNewIds(element)

		currentParentElementArray.splice(indexOfElement + 1, 0, clone)

		this.elementConversionCache.queueInvalidate(clone.id)
		this.#host.commitChange(true)
		this.#host.emitElementChanged(clone.id)

		return clone.id
	}

	setElementName(id: string, name: string): boolean {
		const currentElementLocation = this.#findElementIndexAndParent(this.drawElementsList, null, id)
		if (!currentElementLocation) return false

		currentElementLocation.element.name = name

		this.#host.commitChange(false)

		return true
	}

	setElementUsage(id: string, usage: ButtonGraphicsElementUsage): boolean {
		const currentElementLocation = this.#findElementIndexAndParent(this.drawElementsList, null, id)
		if (!currentElementLocation) return false

		currentElementLocation.element.usage = usage

		// Trigger a redraw, as this could affect listeners of the properties
		this.#host.commitChange(true)

		return true
	}

	getElementById(id: string): SomeButtonGraphicsElement | undefined {
		return this.#findElementIndexAndParent(this.drawElementsList, null, id)?.element
	}

	selectedElementIds(): { [usage in ButtonGraphicsElementUsage]: string | undefined } {
		return {
			[ButtonGraphicsElementUsage.Automatic]: undefined, // Not valid here
			[ButtonGraphicsElementUsage.Text]: this.#selectLayerForUsage(ButtonGraphicsElementUsage.Text, 'text')?.id,
			[ButtonGraphicsElementUsage.Image]: this.#selectLayerForUsage(ButtonGraphicsElementUsage.Image, 'image')?.id,
			[ButtonGraphicsElementUsage.Color]: this.#selectLayerForUsage(ButtonGraphicsElementUsage.Color, 'box')?.id,
		}
	}

	moveElement(id: string, parentElementId: string | null, newIndex: number): boolean {
		const currentElementLocation = this.#findElementIndexAndParent(this.drawElementsList, null, id)
		if (!currentElementLocation) return false
		const { indexOfElement, currentParentElementId, currentParentElementArray } = currentElementLocation

		// Can't move to or from the first element
		if ((indexOfElement === 0 && currentParentElementId === null) || (newIndex === 0 && parentElementId === null))
			return false

		// Cycle detection: prevent moving an element into itself or one of its own descendants
		if (parentElementId !== null) {
			if (parentElementId === id) return false
			const { element } = currentElementLocation
			if (element.type === 'group' && this.#findGroupElementById(element.children, parentElementId) !== null)
				return false
		}

		const targetElementArray = parentElementId
			? this.#findGroupElementById(this.drawElementsList, parentElementId)?.children
			: this.drawElementsList

		if (!targetElementArray) return false
		if (newIndex < 0 || newIndex > targetElementArray.length) return false

		const element = currentParentElementArray.splice(indexOfElement, 1)[0]
		targetElementArray.splice(newIndex, 0, element)

		this.#host.commitChange(true)

		return true
	}

	updateOption(id: string, key: string, newVal: ExpressionOrValue<JsonValue | undefined>): boolean {
		// Ignore some fixed properties
		if (key === 'id' || key === 'type' || key === 'name') return false

		const currentElementLocation = this.#findElementIndexAndParent(this.drawElementsList, null, id)
		if (!currentElementLocation) return false

		const entry = currentElementLocation.element as any
		if (!entry[key]) return false

		entry[key] = newVal

		this.elementConversionCache.queueInvalidate(id)
		this.#host.commitChange(true)
		this.#host.emitElementChanged(id)

		return true
	}

	updateFromLegacyProperties(diff: Partial<ButtonStyleProperties>, canModifyStyleInApis: boolean): boolean {
		if (!canModifyStyleInApis) return false

		const changedElements = new Set<string>()

		const lazyTextElement = lazy(() => {
			const elm = this.#selectLayerForUsage<ButtonGraphicsTextElement>(ButtonGraphicsElementUsage.Text, 'text')
			if (elm) changedElements.add(elm.id)
			return elm
		})
		const lazyBoxElement = lazy(() => {
			const elm = this.#selectLayerForUsage<ButtonGraphicsBoxElement>(ButtonGraphicsElementUsage.Color, 'box')
			if (elm) changedElements.add(elm.id)
			return elm
		})
		const lazyImageElement = lazy(() => {
			const elm = this.#selectLayerForUsage<ButtonGraphicsImageElement>(ButtonGraphicsElementUsage.Image, 'image')
			if (elm) changedElements.add(elm.id)
			return elm
		})
		const canvasElement = this.drawElementsList.find((e) => e.type === 'canvas')

		const parsedStyle = ParseLegacyStyle(diff)

		if (parsedStyle.text.text !== undefined) {
			const textElement = lazyTextElement()
			if (textElement) textElement.text = parsedStyle.text.text
		}

		if (parsedStyle.text.size !== undefined) {
			const textElement = lazyTextElement()
			if (textElement) {
				textElement.fontsize = { isExpression: false, value: parsedStyle.text.size }
				textElement.fontsizeAllowShrink = { isExpression: false, value: parsedStyle.text.sizeAllowShrink ?? false }
			}
		}

		if (parsedStyle.text.color !== undefined) {
			const textElement = lazyTextElement()
			if (textElement) textElement.color = { isExpression: false, value: parsedStyle.text.color }
		}

		if (parsedStyle.text.halign !== undefined) {
			const textElement = lazyTextElement()
			if (textElement) textElement.halign = { isExpression: false, value: parsedStyle.text.halign }
		}
		if (parsedStyle.text.valign !== undefined) {
			const textElement = lazyTextElement()
			if (textElement) textElement.valign = { isExpression: false, value: parsedStyle.text.valign }
		}

		if (parsedStyle.image.halign !== undefined) {
			const imageElement = lazyImageElement()
			if (imageElement) imageElement.halign = { isExpression: false, value: parsedStyle.image.halign }
		}
		if (parsedStyle.image.valign !== undefined) {
			const imageElement = lazyImageElement()
			if (imageElement) imageElement.valign = { isExpression: false, value: parsedStyle.image.valign }
		}

		if (parsedStyle.image.image !== undefined) {
			const imageElement = lazyImageElement()
			if (imageElement) imageElement.base64Image = { isExpression: false, value: parsedStyle.image.image }
		}

		if (parsedStyle.background.color !== undefined) {
			const boxElement = lazyBoxElement()
			if (boxElement) boxElement.color = { isExpression: false, value: parsedStyle.background.color }
		}

		if (parsedStyle.canvas.decoration !== undefined && canvasElement) {
			canvasElement.decoration = { isExpression: false, value: parsedStyle.canvas.decoration }
			changedElements.add(canvasElement.id)
		}

		if (changedElements.size === 0) return false

		for (const elementId of changedElements) {
			this.elementConversionCache.delete(elementId)
		}

		this.#host.commitChange(true)

		for (const elementId of changedElements) {
			this.#host.emitElementChanged(elementId)
		}

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

	#selectLayerForUsage<TElement extends ButtonGraphicsElementBase & { type: string }>(
		usage: ButtonGraphicsElementUsage,
		layerType: TElement['type']
	): TElement | undefined {
		return (
			LayeredButtonStyleEditor.#selectFirstLayerWithUsage<TElement>(this.drawElementsList, usage, layerType) ||
			LayeredButtonStyleEditor.#selectFirstLayerOfType<TElement>(this.drawElementsList, layerType)
		)
	}

	static #selectFirstLayerWithUsage<TElement extends ButtonGraphicsElementBase & { type: string }>(
		elements: SomeButtonGraphicsElement[],
		usage: ButtonGraphicsElementUsage,
		layerType: TElement['type']
	): TElement | undefined {
		for (const element of elements) {
			if (element.type === 'group') {
				const match = LayeredButtonStyleEditor.#selectFirstLayerWithUsage<TElement>(element.children, usage, layerType)
				if (match) return match
			} else if (element.type === layerType && element.usage === usage) {
				return element as unknown as TElement
			}
		}

		return undefined
	}

	static #selectFirstLayerOfType<TElement extends ButtonGraphicsElementBase & { type: string }>(
		elements: SomeButtonGraphicsElement[],
		layerType: TElement['type']
	): TElement | undefined {
		for (const element of elements) {
			if (element.type === 'group') {
				const match = LayeredButtonStyleEditor.#selectFirstLayerOfType<TElement>(element.children, layerType)
				if (match) return match
			} else if (element.type === layerType && element.usage === ButtonGraphicsElementUsage.Automatic) {
				return element as unknown as TElement
			}
		}

		return undefined
	}
}
