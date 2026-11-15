import type { JsonValue } from 'type-fest'
import type z from 'zod'
import { isCustomConnectionId } from '@companion-app/shared/ConnectionId.js'
import { CreateCustomElementControlId, type CustomElementControlId } from '@companion-app/shared/ControlId.js'
import { diffObject } from '@companion-app/shared/Diff.js'
import type { NoRuntimeProps } from '@companion-app/shared/Model/Controls.js'
import {
	CustomElementOptionsSchema,
	getCustomElementUseDefinition,
	type ClientCustomElementData,
	type CustomElementModel,
	type CustomElementOptions,
} from '@companion-app/shared/Model/CustomElementModel.js'
import type { ExpressionOrValue } from '@companion-app/shared/Model/Options.js'
import type { SomeButtonGraphicsElement } from '@companion-app/shared/Model/StyleLayersModel.js'
import {
	ButtonGraphicsElementUsage,
	type ButtonStyleProperties,
	type CompositeElementOptionKey,
} from '@companion-app/shared/Model/StyleModel.js'
import type { VariableValues } from '@companion-app/shared/Model/Variables.js'
import type { KeyValueChange } from '@companion-app/shared/Util/KeyValue.js'
import type { CompositeElementDefinition } from '../../Instance/Definitions.js'
import { VisitorReferencesCollector } from '../../Resources/Visitors/ReferencesCollector.js'
import { VisitorReferencesUpdater } from '../../Resources/Visitors/ReferencesUpdater.js'
import { VisitorVariableRenamer } from '../../Resources/Visitors/VariableRenamer.js'
import { BuildingBlockInputs } from '../BuildingBlocks/BuildingBlockInputs.js'
import type { ControlPressSource } from '../ButtonPressEvents.js'
import { ControlBase } from '../ControlBase.js'
import type { ControlDependencies } from '../ControlDependencies.js'
import { buildCustomActionInputVariables } from '../CustomActionRunFrame.js'
import type { CustomActionCallAnalysis } from '../CustomActions/CustomActionCalls.js'
import type {
	ControlWithBuildingBlockInputs,
	ControlWithLayeredStyle,
	ControlWithOptions,
	ControlWithoutActions,
	ControlWithoutActionSets,
	ControlWithoutEntities,
	ControlWithoutEvents,
	ControlWithoutPushed,
} from '../IControlFragments.js'
import { parseOptionsField } from '../OptionsField.js'
import { ElementTreeEditor } from './Button/ElementTreeEditor.js'
import { normalizeLoadedElements } from './Button/LayerUtils.js'

/**
 * Class for a custom element: a user defined tree of elements, with user defined inputs, which is offered as a
 * composite element of its own. It draws nothing itself, it is drawn by the elements which use it.
 *
 * @author Julian Waller <me@julusian.co.uk>
 * @copyright 2026 Bitfocus AS
 * @license
 * This program is free software.
 * You should have received a copy of the MIT licence as well as the Bitfocus
 * Individual Contributor License Agreement for Companion along with
 * this program.
 */
export class ControlCustomElement
	extends ControlBase<CustomElementControlId, CustomElementModel, NoRuntimeProps>
	implements
		ControlWithoutActions,
		ControlWithoutEvents,
		ControlWithoutEntities,
		ControlWithLayeredStyle,
		ControlWithoutActionSets,
		ControlWithOptions<CustomElementOptions>,
		ControlWithoutPushed,
		ControlWithBuildingBlockInputs
{
	readonly type = 'custom-element'

	readonly supportsActions = false
	readonly supportsConvert = false
	readonly supportsEvents = false
	readonly supportsEntities = false
	readonly supportsLayeredStyle = true
	readonly supportsActionSets = false
	readonly supportsOptions = true
	readonly supportsPushed = false
	readonly supportsBuildingBlockInputs = true

	readonly optionsSchema: z.ZodType<CustomElementOptions> = CustomElementOptionsSchema

	/**
	 * The last sent custom element json object
	 */
	#lastSentClientJson: ClientCustomElementData | null = null

	/**
	 * Basic configuration
	 */
	options: CustomElementOptions

	/**
	 * The elements drawn in place of the custom element
	 */
	#elements: SomeButtonGraphicsElement[] = []

	/**
	 * What it uses through the other custom elements
	 */
	#useAnalysis: CustomActionCallAnalysis | null = null

	readonly #tree: ElementTreeEditor

	readonly buildingBlockInputs: BuildingBlockInputs

	/**
	 * @param deps - the control dependencies
	 * @param controlId - id of the control
	 * @param storage - persisted storage object
	 */
	constructor(deps: ControlDependencies, controlId: CustomElementControlId, storage: CustomElementModel | null) {
		super(deps, controlId, `Controls/ControlTypes/CustomElement/${controlId}`)

		this.options = this.optionsSchema.parse({})

		this.buildingBlockInputs = new BuildingBlockInputs(
			{
				rename: (fromVariableId, toVariableId) =>
					new VisitorVariableRenamer(deps.internalModule, fromVariableId, toVariableId).visitDrawElements(
						this.#elements
					),
			},
			() => {
				this.commitChange()
				// The preview of every element is drawn with the default values of the inputs, so must be drawn again
				this.#emitAllElementsChanged()
			}
		)

		if (storage) {
			if (storage.type !== 'custom-element')
				throw new Error(`Invalid type given to ControlCustomElement: "${storage.type}"`)

			this.options = { ...this.options, ...storage.options }
			// The inputs and elements are checked by the schema of the custom element when it is loaded
			this.buildingBlockInputs.loadStorage(storage.inputs)
			// Never a canvas, as it is drawn inside the bounds of its use
			this.#elements = storage.elements.filter((element) => element.type !== 'canvas')
			normalizeLoadedElements(this.#elements)
		}

		const self = this
		this.#tree = new ElementTreeEditor({
			get elements() {
				return self.#elements
			},
			hasCanvas: false,
			getCompositeElementDefinition: (connectionId, elementId) =>
				deps.instance.definitions.getCompositeElementDefinition(connectionId, elementId),
			canAddCompositeElement: (connectionId, elementId) => this.#canUseElement(connectionId, elementId),
			// Nothing is cached, as it draws nothing itself
			invalidateElement: () => {},
			commitChange: (redraw) => this.commitChange(redraw),
			emitElementChanged: (elementId) => this.deps.events.emit('layeredStyleElementChanged', this.controlId, elementId),
		})
	}

	/**
	 * Whether a composite element can be used in this one, which it can't if it would draw this one
	 */
	#canUseElement(connectionId: string, elementId: string): boolean {
		if (!isCustomConnectionId(connectionId)) return true

		const self = getCustomElementUseDefinition(this.controlId)
		if (!self || self.elementId === elementId) return false

		const other = this.deps.controlsAccessor.getControl(CreateCustomElementControlId(elementId))
		return !(other instanceof ControlCustomElement && other.getUsedCustomElementIds(true).has(self.elementId))
	}

	checkCollectionIdIsValid(validCollectionIds: ReadonlySet<string>): boolean {
		if (this.options.collectionId && !validCollectionIds.has(this.options.collectionId)) {
			// collectionId is not valid, remove it
			this.options.collectionId = undefined

			this.commitChange(false)

			return true
		}

		return false
	}

	/**
	 * The definition of the composite element which uses this custom element
	 * @param id The id of the custom element
	 */
	toCompositeElementDefinition(id: string): CompositeElementDefinition {
		return {
			id,
			name: this.options.name || 'Custom element',
			sortKey: null,
			description: this.options.description || undefined,
			options: this.buildingBlockInputs.toCompanionInputFields(),
			elements: this.#elements,
		}
	}

	#emitAllElementsChanged(): void {
		const visit = (elements: readonly SomeButtonGraphicsElement[]): void => {
			for (const element of elements) {
				this.deps.events.emit('layeredStyleElementChanged', this.controlId, element.id)
				if (element.type === 'group') visit(element.children)
			}
		}
		visit(this.#elements)
	}

	layeredStyleAddElement(type: string, afterElementId: string | null): string {
		return this.#tree.addElement(type, afterElementId)
	}

	layeredStyleRemoveElement(id: string): boolean {
		return this.#tree.removeElement(id)
	}

	layeredStyleDuplicateElement(id: string): string | false {
		return this.#tree.duplicateElement(id)
	}

	layeredStyleMoveElement(id: string, parentElementId: string | null, newIndex: number): boolean {
		return this.#tree.moveElement(id, parentElementId, newIndex)
	}

	layeredStyleSetElementName(id: string, name: string): boolean {
		return this.#tree.setElementName(id, name)
	}

	layeredStyleSetElementUsage(id: string, usage: ButtonGraphicsElementUsage): boolean {
		return this.#tree.setElementUsage(id, usage)
	}

	layeredStyleSetElementPropertyPinned(id: string, property: string, pinned: boolean): boolean {
		return this.#tree.setElementPropertyPinned(id, property, pinned)
	}

	layeredStyleUpdateOption(id: string, key: string, value: ExpressionOrValue<JsonValue | undefined>): boolean {
		return this.#tree.updateOption(id, key, value)
	}

	layeredStyleUpdateOptions(id: string, values: Record<string, ExpressionOrValue<JsonValue | undefined>>): boolean {
		return this.#tree.updateOptions(id, values)
	}

	layeredStyleUpdateFromLegacyProperties(_diff: Partial<ButtonStyleProperties>): boolean {
		// The legacy properties are those of a button
		return false
	}

	layeredStyleGetElementById(id: string): SomeButtonGraphicsElement | undefined {
		return this.#tree.getElementById(id)
	}

	layeredStyleGetElements(): readonly SomeButtonGraphicsElement[] {
		return this.#elements
	}

	layeredStyleSelectedElementIds(): { [usage in ButtonGraphicsElementUsage]: string | undefined } {
		// The legacy properties are those of a button, so no element is used for them
		return {
			[ButtonGraphicsElementUsage.Automatic]: undefined,
			[ButtonGraphicsElementUsage.Text]: undefined,
			[ButtonGraphicsElementUsage.Color]: undefined,
			[ButtonGraphicsElementUsage.Image]: undefined,
			[ButtonGraphicsElementUsage.Leds]: undefined,
		}
	}

	layeredStyleRenameCompositeOption(
		connectionId: string,
		elementId: string,
		fromKey: CompositeElementOptionKey,
		toKey: CompositeElementOptionKey | null
	): boolean {
		return this.#tree.renameCompositeOption(connectionId, elementId, fromKey, toKey)
	}

	layeredStylePreviewVariableValues(): VariableValues {
		return buildCustomActionInputVariables(this.buildingBlockInputs.getDefaultValues())
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
		).visitDrawElements(this.#elements)
	}

	/**
	 * A custom element has no location
	 */
	triggerLocationHasChanged(): void {
		// Nothing to do
	}

	/**
	 * Convert this control to JSON
	 * To be sent to the client and written to the db
	 */
	toJSON(): CustomElementModel {
		return {
			type: this.type,
			options: this.options,
			inputs: this.buildingBlockInputs.toJSON(),
			elements: this.#elements,
		}
	}

	toClientJSON(): ClientCustomElementData {
		return {
			type: this.type,
			...this.options,
			usedCustomElementIds: this.#useAnalysis ? [...this.#useAnalysis.calledIds].sort() : [],
			useLoop: this.#useAnalysis?.loop ?? null,
		}
	}

	/**
	 * Get the ids of the custom elements this uses
	 * @param throughOthers Whether to include those it uses through the other custom elements, as last analysed
	 */
	getUsedCustomElementIds(throughOthers: boolean): ReadonlySet<string> {
		if (throughOthers && this.#useAnalysis) return this.#useAnalysis.calledIds

		const ids = new Set<string>()
		const visit = (elements: readonly SomeButtonGraphicsElement[]): void => {
			for (const element of elements) {
				if (element.type === 'composite' && isCustomConnectionId(element.connectionId)) ids.add(element.elementId)
				if (element.type === 'group') visit(element.children)
			}
		}
		visit(this.#elements)
		return ids
	}

	/**
	 * Set what this uses through the other custom elements
	 */
	setUseAnalysis(analysis: CustomActionCallAnalysis): void {
		this.#useAnalysis = analysis

		this.#sendClientJsonChange()
	}

	/**
	 * Rename an instance for variables used in this control
	 * @param labelFrom - the old instance short name
	 * @param labelTo - the new instance short name
	 */
	renameVariables(labelFrom: string, labelTo: string): void {
		const updater = new VisitorReferencesUpdater(
			this.deps.internalModule,
			{ [labelFrom]: labelTo },
			undefined,
			undefined
		)
		updater.visitDrawElements(this.#elements)

		// 'redraw' if needed and save changes
		this.commitChange(updater.hasChanges())
	}

	/**
	 * Update an option field of this control
	 */
	optionsSetField(change: KeyValueChange<CustomElementOptions>, forceSet?: boolean): boolean {
		if (!forceSet && (change.key === 'sortOrder' || change.key === 'collectionId'))
			throw new Error('sortOrder cannot be set by the client')

		const options = parseOptionsField(this.optionsSchema, this.options, change)
		if (!options) return false

		this.options = options

		this.commitChange()

		return true
	}

	toRuntimeJSON(): NoRuntimeProps {
		return {}
	}

	override start(save: boolean): void {
		if (save) this.commitChange()
	}

	/**
	 * Emit a change to the client json of this control.
	 */
	#sendClientJsonChange(): void {
		const newJson = structuredClone(this.toClientJSON())

		if (this.deps.changeEvents.listenerCount('customElementChange') > 0) {
			if (this.#lastSentClientJson) {
				const patch = diffObject(this.#lastSentClientJson || {}, newJson || {})
				if (patch.length > 0) {
					this.deps.changeEvents.emit('customElementChange', this.controlId, {
						type: 'update',
						controlId: this.controlId,
						patch,
					})
				}
			} else {
				this.deps.changeEvents.emit('customElementChange', this.controlId, {
					type: 'add',
					controlId: this.controlId,
					info: newJson,
				})
			}
		}

		this.#lastSentClientJson = newJson
	}

	commitChange(redraw = true): void {
		super.commitChange(redraw)

		this.#sendClientJsonChange()

		this.deps.events.emit('customElementDefinitionChanged', this.controlId)
	}

	destroy(): void {
		super.destroy()

		this.deps.events.emit('customElementDefinitionChanged', this.controlId)

		if (this.deps.changeEvents.listenerCount('customElementChange') > 0) {
			this.deps.changeEvents.emit('customElementChange', this.controlId, {
				type: 'remove',
				controlId: this.controlId,
			})
		}
	}

	/**
	 * Nothing to react to, as a custom element doesn't draw anything on its own. The elements which use it are drawn
	 * again when its definition changes
	 */
	protected triggerInvalidation(): void {
		// Nothing to do
	}

	get drawing(): null {
		return null // Custom elements don't draw
	}

	/**
	 * Execute a press of this control
	 */
	pressControl(_pressed: boolean, _source: ControlPressSource | null): void {
		// Nothing to do
	}
}
