import { nanoid } from 'nanoid'
import type { JsonValue } from 'type-fest'
import { formatLocation } from '@companion-app/shared/ControlId.js'
import { FONTSIZE_SHRINK_DEFAULT } from '@companion-app/shared/Graphics/ElementPropertiesSchemas.js'
import type {
	LayeredButtonModel,
	LayeredButtonOptions,
	NormalButtonRuntimeProps,
} from '@companion-app/shared/Model/ButtonModel.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import type { ExpressionOrValue } from '@companion-app/shared/Model/Options.js'
import type {
	ButtonGraphicsBoxElement,
	ButtonGraphicsElementBase,
	ButtonGraphicsGroupElement,
	ButtonGraphicsImageElement,
	ButtonGraphicsTextElement,
	SomeButtonGraphicsElement,
} from '@companion-app/shared/Model/StyleLayersModel.js'
import {
	ButtonGraphicsDecorationType,
	ButtonGraphicsElementUsage,
	ButtonGraphicsShowStatusIcons,
	type ButtonStyleProperties,
	type DrawStyleLayeredButtonModel,
} from '@companion-app/shared/Model/StyleModel.js'
import type { VariableValues } from '@companion-app/shared/Model/Variables.js'
import { ConvertSomeButtonGraphicsElementForDrawing } from '../../../Graphics/ConvertGraphicsElements.js'
import { ElementConversionCache } from '../../../Graphics/ElementConversionCache.js'
import type { ImageResult } from '../../../Graphics/ImageResult.js'
import type { CompositeElementIdString } from '../../../Instance/Definitions.js'
import { ParseLegacyStyle } from '../../../Resources/ConvertLegacyStyleToElements.js'
import { lazy } from '../../../Resources/Util.js'
import { VisitorReferencesCollector } from '../../../Resources/Visitors/ReferencesCollector.js'
import { VisitorReferencesUpdater } from '../../../Resources/Visitors/ReferencesUpdater.js'
import type { ControlDependencies } from '../../ControlDependencies.js'
import type { ControlActionSetAndStepsManager } from '../../Entities/ControlActionSetAndStepsManager.js'
import type { ControlEntityListChangeProps } from '../../Entities/EntityListPoolBase.js'
import type {
	ControlWithActions,
	ControlWithActionSets,
	ControlWithLayeredStyle,
	ControlWithoutEvents,
} from '../../IControlFragments.js'
import { ButtonControlBase } from './Base.js'
import { CreateElementOfType } from './LayerDefaults.js'
import { cloneElementWithNewIds } from './LayerUtils.js'

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
	implements ControlWithLayeredStyle, ControlWithActions, ControlWithoutEvents, ControlWithActionSets
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
			showStatusIcons: { value: ButtonGraphicsShowStatusIcons.FollowDefault, isExpression: false },
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
			width: { value: 100, isExpression: false },
			height: { value: 100, isExpression: false },
			rotation: { value: 0, isExpression: false },
			color: { value: 0x000000, isExpression: false },
			borderWidth: { value: 0, isExpression: false },
			borderColor: { value: 0, isExpression: false },
			borderPosition: { value: 'inside', isExpression: false },
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
			width: { value: 100, isExpression: false },
			height: { value: 100, isExpression: false },
			rotation: { value: 0, isExpression: false },
			text: { value: '', isExpression: false },
			color: { value: 0xffffff, isExpression: false },
			halign: { value: 'center', isExpression: false },
			valign: { value: 'center', isExpression: false },
			fontsize: { value: FONTSIZE_SHRINK_DEFAULT, isExpression: false },
			fontsizeAllowShrink: { value: true, isExpression: false },
			font: { value: 'companion-sans', isExpression: false },
			outlineColor: { value: 0xff000000, isExpression: false },
		},
	]

	readonly supportsActions = true
	readonly supportsEvents = false
	readonly supportsActionSets = true
	readonly supportsLayeredStyle = true

	/**
	 * The variables referenced in the last draw. Whenever one of these changes, a redraw should be performed
	 */
	#lastDrawVariables: ReadonlySet<string> | null = null
	#lastDrawCompositeElements: ReadonlySet<CompositeElementIdString> | null = null

	/**
	 * Location strings (e.g. '1/0/0') of buttons this control references via reference elements.
	 * When any of these locations are re-rendered, this control must be re-rendered too.
	 */
	#lastDrawReferencedLocations: ReadonlySet<string> | null = null

	/**
	 * Locations where a reference cycle was detected in the last draw.
	 * Used to suppress redundant redraws when we're already showing ∞ for a location.
	 */
	#lastCyclicReferences: ReadonlySet<string> | null = null

	/**
	 * The base style without feedbacks applied
	 */
	#drawElements: SomeButtonGraphicsElement[] = structuredClone(ControlButtonLayered.DefaultElements)

	/**
	 * Cache for element conversion results (for future per-element caching optimization)
	 */
	readonly #elementConversionCache = new ElementConversionCache()

	get actionSets(): ControlActionSetAndStepsManager {
		return this.entities
	}

	constructor(deps: ControlDependencies, controlId: string, storage: LayeredButtonModel | null, isImport: boolean) {
		super(deps, controlId, `Controls/Button/Normal/${controlId}`, true)

		this.options = {
			...structuredClone(ButtonControlBase.DefaultOptions),
			rotaryActions: false,
			canModifyStyleInApis: false,
			notes: '',
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
			this.entities.stepExpressionUpdate(this.options)

			// HACK: temporary fill in new properties
			for (const element of this.#drawElements) {
				if (element.type !== 'canvas') {
					try {
						const defaults = CreateElementOfType(element.type)
						for (const key of Object.keys(defaults)) {
							if (key === 'id' || key === 'type' || key === 'name') continue
							if (!(key in element)) {
								;(element as any)[key] = (defaults as any)[key]
							}
						}
					} catch (_e) {
						// Ignore
					}
				}
				switch (element.type) {
					case 'canvas':
						if (!element.showStatusIcons)
							element.showStatusIcons = { value: ButtonGraphicsShowStatusIcons.FollowDefault, isExpression: false }
						break
					case 'image':
						if (!element.fillMode.isExpression && (element.fillMode.value as string) === 'fit_or_shrink') {
							element.fillMode.value = 'fit'
						}
						break
				}
			}

			// Ensure control is stored before setup
			if (isImport) setImmediate(() => this.postProcessImport())
		}

		// Listen for other controls finishing rendering (needed for reference element invalidation)
		this.deps.graphics.on('button_drawn', this.onReferencedButtonDrawn)
	}

	/**
	 * Prepare this control for deletion
	 */
	destroy(): void {
		this.deps.graphics.off('button_drawn', this.onReferencedButtonDrawn)
		this.#elementConversionCache.clear()
		super.destroy()
	}

	protected override entityListReportChange(options: ControlEntityListChangeProps): void {
		if (!options.noSave) {
			this.commitChange(false)
		}
		if (options.invalidateAllElements) {
			this.#elementConversionCache.clear()
		} else if (options.changedElementIds) {
			for (const elementId of options.changedElementIds) {
				this.#elementConversionCache.queueInvalidate(elementId)
			}
		}

		if (options.redraw || options.changedElementIds || options.invalidateAllElements) {
			this.triggerRedraw()
		}
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
		const injectedVariableValues: VariableValues = {}
		const location = this.deps.pageStore.getLocationOfControlId(this.controlId)
		if (location) {
			// Ensure we don't enter into an infinite loop
			// TODO - legacy location variables?
			// injectedVariableValues[`internal:b_text_${location.pageNumber}_${location.row}_${location.column}`] = '$RE'
		}

		const parser = this.deps.variableValues.createVariablesAndExpressionParser(
			location,
			this.entities.getLocalVariableEntities(),
			injectedVariableValues
		)

		const locationStr = location ? formatLocation(location) : null

		const feedbackOverrides = this.entities.getFeedbackStyleOverrides()

		// Compute the new drawing, using the element conversion cache for per-element caching
		const { elements, usedVariables, usedCompositeElements, referencedLocations, cyclicLocations } =
			await ConvertSomeButtonGraphicsElementForDrawing(
				this.deps.instance.definitions,
				parser,
				this.deps.graphics.renderPixelBuffers.bind(this.deps.graphics),
				this.#drawElements,
				feedbackOverrides,
				true,
				this.#elementConversionCache,
				locationStr,
				(location) => this.deps.graphics.getCachedRender(location) ?? null
			)
		this.#lastDrawVariables = usedVariables.size > 0 ? usedVariables : null
		this.#lastDrawCompositeElements = usedCompositeElements.size > 0 ? usedCompositeElements : null
		this.#lastDrawReferencedLocations = referencedLocations.size > 0 ? referencedLocations : null
		this.#lastCyclicReferences = cyclicLocations.size > 0 ? cyclicLocations : null

		const result: DrawStyleLayeredButtonModel = {
			...this.getDrawStyleButtonStateProps(),

			elements,
			referencedLocations,

			style: 'button-layered',
			drawType: 'button',
		}

		this.#lastDrawStyle = result
		return result
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
		new VisitorReferencesCollector(
			this.deps.internalModule,
			foundConnectionIds,
			foundConnectionLabels,
			foundVariables,
			undefined
		)
			.visitEntities(this.entities.getAllEntities(), [])
			.visitDrawElements(this.#drawElements)
	}

	/**
	 * Inform the control that it has been moved, and anything relying on its location must be invalidated
	 */
	triggerLocationHasChanged(): void {
		super.triggerLocationHasChanged()

		// Ensure any dependencies on the location in the drawing are updated
		this.#elementConversionCache.clear()
		this.triggerRedraw()
	}

	layeredStyleAddElement(type: string, index: number | null): string {
		let newElement: SomeButtonGraphicsElement

		// Check if this is a composite element (contains semicolon)
		if (type.includes(';')) {
			const [connectionId, elementId] = type.split(';', 2)
			const compositeDefinition = this.deps.instance.definitions.getCompositeElementDefinition(connectionId, elementId)

			if (compositeDefinition) {
				// Create a composite element directly
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

				// Add custom properties from schema with their default values
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
			// Standard element type
			newElement = CreateElementOfType(type as SomeButtonGraphicsElement['type'])
		}

		if (typeof index === 'number' && index >= 0 && index < this.#drawElements.length) {
			this.#drawElements.splice(index, 0, newElement)
		} else {
			this.#drawElements.push(newElement)
		}

		// Invalidate cache for the new element
		this.#elementConversionCache.queueInvalidate(newElement.id)

		// Save change and redraw
		this.commitChange(true)

		// Emit element change event
		this.deps.events.emit('layeredStyleElementChanged', this.controlId, newElement.id)

		return newElement.id
	}

	layeredStyleRemoveElement(id: string): boolean {
		const currentElementLocation = this.#findElementIndexAndParent(this.#drawElements, null, id)
		if (!currentElementLocation) return false

		const { indexOfElement, element, currentParentElementArray } = currentElementLocation

		// Canvas is the fixed background element and cannot be removed
		if (element.type === 'canvas') return false

		currentParentElementArray.splice(indexOfElement, 1)

		// Invalidate cache for the removed element
		this.#elementConversionCache.queueInvalidate(id)

		// Save change and redraw
		this.commitChange(true)

		// Emit element change event
		this.deps.events.emit('layeredStyleElementChanged', this.controlId, id)

		return true
	}

	layeredStyleDuplicateElement(id: string): string | false {
		const currentElementLocation = this.#findElementIndexAndParent(this.#drawElements, null, id)
		if (!currentElementLocation) return false

		const { indexOfElement, element, currentParentElementArray } = currentElementLocation

		// Canvas is the fixed background element and cannot be duplicated
		if (element.type === 'canvas') return false

		const clone = cloneElementWithNewIds(element)

		currentParentElementArray.splice(indexOfElement + 1, 0, clone)

		this.#elementConversionCache.queueInvalidate(clone.id)

		this.commitChange(true)

		this.deps.events.emit('layeredStyleElementChanged', this.controlId, clone.id)

		return clone.id
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

	layeredStyleGetElementById(id: string): SomeButtonGraphicsElement | undefined {
		const result = this.#findElementIndexAndParent(this.#drawElements, null, id)
		return result?.element
	}

	layeredStyleSelectedElementIds(): { [usage in ButtonGraphicsElementUsage]: string | undefined } {
		return {
			[ButtonGraphicsElementUsage.Automatic]: undefined, // Not valid here
			[ButtonGraphicsElementUsage.Text]: this.SelectLayerForUsage(ButtonGraphicsElementUsage.Text, 'text')?.id,
			[ButtonGraphicsElementUsage.Image]: this.SelectLayerForUsage(ButtonGraphicsElementUsage.Image, 'image')?.id,
			[ButtonGraphicsElementUsage.Color]: this.SelectLayerForUsage(ButtonGraphicsElementUsage.Color, 'box')?.id,
		}
	}

	layeredStyleMoveElement(id: string, parentElementId: string | null, newIndex: number): boolean {
		const currentElementLocation = this.#findElementIndexAndParent(this.#drawElements, null, id)
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

	layeredStyleUpdateOption(id: string, key: string, newVal: ExpressionOrValue<JsonValue | undefined>): boolean {
		// Ignore some fixed properties
		if (key === 'id' || key === 'type' || key === 'name') return false

		// Find the element
		const currentElementLocation = this.#findElementIndexAndParent(this.#drawElements, null, id)
		if (!currentElementLocation) return false

		const { element } = currentElementLocation

		const entry = element as any
		if (!entry[key]) return false

		// Replace the entire ExpressionOrValue with the provided value
		entry[key] = newVal

		// Invalidate cache for this element
		this.#elementConversionCache.queueInvalidate(id)

		// Save change and redraw
		this.commitChange(true)

		// Emit element change event
		this.deps.events.emit('layeredStyleElementChanged', this.controlId, id)

		return true
	}

	layeredStyleUpdateFromLegacyProperties(diff: Partial<ButtonStyleProperties>): boolean {
		if (!this.options.canModifyStyleInApis) return false

		const changedElements = new Set<string>()

		const lazyTextElement = lazy(() => {
			const elm = this.SelectLayerForUsage<ButtonGraphicsTextElement>(ButtonGraphicsElementUsage.Text, 'text')
			if (elm) changedElements.add(elm.id)
			return elm
		})
		const lazyBoxElement = lazy(() => {
			const elm = this.SelectLayerForUsage<ButtonGraphicsBoxElement>(ButtonGraphicsElementUsage.Color, 'box')
			if (elm) changedElements.add(elm.id)
			return elm
		})
		const lazyImageElement = lazy(() => {
			const elm = this.SelectLayerForUsage<ButtonGraphicsImageElement>(ButtonGraphicsElementUsage.Image, 'image')
			if (elm) changedElements.add(elm.id)
			return elm
		})
		const canvasElement = this.#drawElements.find((e) => e.type === 'canvas')

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

		// Invalidate changed elements
		for (const elementId of changedElements) {
			this.#elementConversionCache.delete(elementId)
		}

		// Save changes and redraw
		this.commitChange(true)

		// Emit element change event
		for (const elementId of changedElements) {
			this.deps.events.emit('layeredStyleElementChanged', this.controlId, elementId)
		}

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
		const changed = new VisitorReferencesUpdater(
			this.deps.internalModule,
			{ [labelFrom]: labelTo },
			undefined,
			undefined
		)
			.visitEntities(allEntities, [])
			.visitDrawElements(this.#drawElements)
			.recheckChangedFeedbacks()
			.hasChanges()

		if (changed) {
			// Purge all cache, as we don't know what could have changed
			this.#elementConversionCache.clear()
		}

		// redraw if needed and save changes
		this.commitChange(changed)
	}

	/**
	 * Propagate variable changes
	 * @param allChangedVariables - variables with changes
	 */
	onVariablesChanged(allChangedVariables: ReadonlySet<string>): void {
		if (!this.#lastDrawVariables) return
		if (this.#lastDrawVariables.isDisjointFrom(allChangedVariables)) return

		// Queue invalidation for cached elements that use any of the changed variables
		this.#elementConversionCache.queueInvalidateVariables(allChangedVariables)

		this.logger.silly('variable changed in button ' + this.controlId)
		this.triggerRedraw()
	}

	/**
	 * Update an option field of this control
	 */
	optionsSetField(key: string, value: JsonValue): boolean {
		const changed = super.optionsSetField(key, value)

		if (key === 'stepProgression' || key === 'stepExpression') {
			this.entities.stepExpressionUpdate(this.options)
		}

		return changed
	}

	/**
	 * Propagate composite element changes
	 * @param allChangedElementIds - composite element ids with changes
	 */
	onCompositeElementsChanged(allChangedElementIds: ReadonlySet<CompositeElementIdString>): void {
		if (!this.#lastDrawCompositeElements) return
		if (this.#lastDrawCompositeElements.isDisjointFrom(allChangedElementIds)) return

		// Queue invalidation for any cached elements that use these composite types
		this.#elementConversionCache.queueInvalidateCompositeType(allChangedElementIds)

		this.logger.silly('composite element changed in button ' + this.controlId)
		this.triggerRedraw()
	}

	/**
	 * Called after any located control has finished rendering. If this control references the changed
	 * location, invalidate the relevant cache entries and trigger a redraw.
	 */
	onReferencedButtonDrawn = (location: ControlLocation, render: ImageResult): void => {
		const locStr = formatLocation(location)
		if (!this.#lastDrawReferencedLocations?.has(locStr)) return

		// Suppress ping-pong when we're already rendering a cycle: if we're already showing ∞ for this
		// location AND the target still references us back, no visible output would change.
		if (this.#lastCyclicReferences?.has(locStr)) {
			const myLocation = this.deps.pageStore.getLocationOfControlId(this.controlId)
			if (myLocation && render.referencedLocations.has(formatLocation(myLocation))) return
		}

		this.#elementConversionCache.queueInvalidateReferencedLocation(locStr)
		this.logger.silly('referenced control rendered in button ' + this.controlId)
		this.triggerRedraw()
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

		return clone ? structuredClone(obj) : obj
	}

	/**
	 * Get any volatile properties for the control
	 */
	override toRuntimeJSON(): NormalButtonRuntimeProps {
		return {
			current_step_id: this.entities.currentStepId,
		}
	}

	private SelectLayerForUsage<TElement extends ButtonGraphicsElementBase & { type: string }>(
		usage: ButtonGraphicsElementUsage,
		layerType: TElement['type']
	): TElement | undefined {
		return (
			ControlButtonLayered.SelectFirstLayerWithUsage<TElement>(this.#drawElements, usage, layerType) ||
			ControlButtonLayered.SelectFirstLayerOfType<TElement>(this.#drawElements, layerType)
		)
	}

	private static SelectFirstLayerWithUsage<TElement extends ButtonGraphicsElementBase & { type: string }>(
		elements: SomeButtonGraphicsElement[],
		usage: ButtonGraphicsElementUsage,
		layerType: TElement['type']
	): TElement | undefined {
		for (const element of elements) {
			if (element.type === 'group') {
				const match = ControlButtonLayered.SelectFirstLayerWithUsage<TElement>(element.children, usage, layerType)
				if (match) return match
			} else if (element.type === layerType && element.usage === usage) {
				// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
				return element as unknown as TElement
			}
		}

		return undefined
	}

	private static SelectFirstLayerOfType<TElement extends ButtonGraphicsElementBase & { type: string }>(
		elements: SomeButtonGraphicsElement[],
		layerType: TElement['type']
	): TElement | undefined {
		for (const element of elements) {
			if (element.type === 'group') {
				const match = ControlButtonLayered.SelectFirstLayerOfType<TElement>(element.children, layerType)
				if (match) return match
			} else if (element.type === layerType && element.usage === ButtonGraphicsElementUsage.Automatic) {
				// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
				return element as unknown as TElement
			}
		}

		return undefined
	}
}
