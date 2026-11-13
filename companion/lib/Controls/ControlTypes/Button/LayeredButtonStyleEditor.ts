import type {
	ButtonGraphicsBoxElement,
	ButtonGraphicsElementBase,
	ButtonGraphicsImageElement,
	ButtonGraphicsTextElement,
	SomeButtonGraphicsElement,
} from '@companion-app/shared/Model/StyleLayersModel.js'
import { ButtonGraphicsElementUsage, type ButtonStyleProperties } from '@companion-app/shared/Model/StyleModel.js'
import { ParseLegacyStyle } from '../../../Resources/ConvertLegacyStyleToElements.js'
import { lazy } from '../../../Resources/Util.js'
import type { ControlDependencies } from '../../ControlDependencies.js'
import type { ButtonControlId } from './Base.js'
import { ElementTreeEditor } from './ElementTreeEditor.js'
import { LayeredButtonDrawer, type LayeredButtonDrawerHost } from './LayeredButtonDrawer.js'

/**
 * The drawer host extended with the persistence callbacks the editing operations need.
 */
export interface LayeredButtonStyleEditorHost extends LayeredButtonDrawerHost {
	commitChange(redraw?: boolean): void
	emitElementChanged(elementId: string): void
}

/**
 * A {@link LayeredButtonDrawer} that additionally owns the layered-style **editing** operations: those of any tree of
 * elements (add / remove / duplicate / move / rename / reusage / option) on `tree`, and those only a button has
 * (legacy-style, the element for each usage). Composed only by the editable layered button; read-only controls (e.g.
 * the preset reference) compose the plain {@link LayeredButtonDrawer}, so they have no way to mutate their style.
 *
 * Each mutator updates the elements and conversion cache owned by the base drawer, then `commitChange`s and
 * emits the element-changed event via the host.
 */
export class LayeredButtonStyleEditor extends LayeredButtonDrawer {
	readonly #host: LayeredButtonStyleEditorHost

	/** The editing operations shared with the other editable trees of elements */
	readonly tree: ElementTreeEditor

	constructor(deps: ControlDependencies, controlId: ButtonControlId, host: LayeredButtonStyleEditorHost) {
		super(deps, controlId, host)
		this.#host = host

		const self = this
		this.tree = new ElementTreeEditor({
			get elements() {
				return self.drawElementsList
			},
			hasCanvas: true,
			getCompositeElementDefinition: (connectionId, elementId) =>
				deps.instance.definitions.getCompositeElementDefinition(connectionId, elementId),
			// A button is never a composite element, so can't be drawn by one
			canAddCompositeElement: () => true,
			invalidateElement: (elementId) => this.elementConversionCache.queueInvalidate(elementId),
			commitChange: (redraw) => host.commitChange(redraw),
			emitElementChanged: (elementId) => host.emitElementChanged(elementId),
		})
	}

	selectedElementIds(): { [usage in ButtonGraphicsElementUsage]: string | undefined } {
		return {
			[ButtonGraphicsElementUsage.Automatic]: undefined, // Not valid here
			[ButtonGraphicsElementUsage.Text]: this.#selectLayerForUsage(ButtonGraphicsElementUsage.Text, 'text')?.id,
			[ButtonGraphicsElementUsage.Image]: this.#selectLayerForUsage(ButtonGraphicsElementUsage.Image, 'image')?.id,
			[ButtonGraphicsElementUsage.Color]: this.#selectLayerForUsage(ButtonGraphicsElementUsage.Color, 'box')?.id,
			[ButtonGraphicsElementUsage.Leds]: this.#selectLayerForUsage(ButtonGraphicsElementUsage.Leds, 'gauge')?.id,
		}
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

		const parsedStyle = ParseLegacyStyle(diff, this.resolveDefaultNoTopBar())

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
