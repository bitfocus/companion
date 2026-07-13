import type { JsonValue } from 'type-fest'
import { CreatePresetControlId } from '@companion-app/shared/ControlId.js'
import type {
	ButtonStatus,
	LayeredButtonOptions,
	NormalButtonRuntimeProps,
	PresetButtonModel,
} from '@companion-app/shared/Model/ButtonModel.js'
import type { ExpressionOrValue } from '@companion-app/shared/Model/Options.js'
import type { SomeButtonGraphicsElement } from '@companion-app/shared/Model/StyleLayersModel.js'
import { ButtonGraphicsElementUsage, type ButtonStyleProperties } from '@companion-app/shared/Model/StyleModel.js'
import type { ImageResult } from '../../../Graphics/ImageResult.js'
import { VisitorReferencesCollector } from '../../../Resources/Visitors/ReferencesCollector.js'
import { VisitorReferencesUpdater } from '../../../Resources/Visitors/ReferencesUpdater.js'
import { ControlBase } from '../../ControlBase.js'
import type { ControlDependencies } from '../../ControlDependencies.js'
import type { ControlEntityListChangeProps } from '../../Entities/EntityListPoolBase.js'
import { ControlEntityListPoolButton } from '../../Entities/EntityListPoolButton.js'
import type {
	ControlWithEntities,
	ControlWithLayeredStyle,
	ControlWithoutActions,
	ControlWithoutActionSets,
	ControlWithoutConvert,
	ControlWithoutEvents,
	ControlWithoutOptions,
	ControlWithoutPushed,
} from '../../IControlFragments.js'
import { ButtonControlBase } from './Base.js'
import { LayeredButtonDrawer } from './LayeredButtonDrawer.js'

/**
 * Class for the preset button control.
 *
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
	extends ControlBase<PresetButtonModel>
	implements
		ControlWithLayeredStyle,
		ControlWithoutActions,
		ControlWithoutEvents,
		ControlWithoutActionSets,
		ControlWithEntities,
		ControlWithoutOptions,
		ControlWithoutPushed,
		ControlWithoutConvert
{
	readonly type = 'preset:button'

	readonly supportsActions = false
	readonly supportsEvents = false
	readonly supportsActionSets = false
	readonly supportsLayeredStyle = true
	readonly supportsEntities = true
	readonly supportsOptions = false
	readonly supportsPushed = false
	readonly supportsConvert = false

	readonly entities: ControlEntityListPoolButton

	readonly #drawing: LayeredButtonDrawer
	override get drawing(): LayeredButtonDrawer {
		return this.#drawing
	}

	protected triggerInvalidation = (): void => {
		this.#drawing.invalidate()
	}

	/**
	 * The current status of this button
	 */
	readonly button_status: ButtonStatus = 'good'

	/**
	 * The config of this button
	 */
	options!: LayeredButtonOptions

	readonly #connectionId: string
	readonly #presetId: string

	#lastRender: ImageResult | null = null

	get lastRender(): ImageResult | null {
		return this.#lastRender
	}

	constructor(
		deps: ControlDependencies,
		connectionId: string,
		presetId: string,
		variablesHash: string,
		storage: PresetButtonModel
	) {
		const controlId = CreatePresetControlId(connectionId, presetId, variablesHash)
		super(deps, controlId, `Controls/Button/Preset/${connectionId}/${presetId}/${variablesHash}`, true)

		this.#connectionId = connectionId
		this.#presetId = presetId

		this.entities = new ControlEntityListPoolButton(
			{
				controlId,
				reportChange: this.#entityListReportChange.bind(this),
				instanceDefinitions: deps.instance.definitions,
				internalModule: deps.internalModule,
				processManager: deps.instance.processManager,
				variableValues: deps.variableValues,
				pageStore: deps.pageStore,
			},
			this.sendRuntimePropsChange.bind(this),
			(expression, requiredType) =>
				deps.variableValues
					.createVariablesAndExpressionParser(
						deps.pageStore.getLocationOfControlId(this.controlId),
						null, // This doesn't support local variables
						null
					)
					.executeExpression(expression, requiredType),
			false
		)

		this.options = {
			...structuredClone(ButtonControlBase.DefaultOptions),
			rotaryActions: false,
			stepProgression: 'auto',
			canModifyStyleInApis: false,
		}

		this.#drawing = new LayeredButtonDrawer(deps, controlId, {
			getButtonStateProps: () => ({
				pushed: false,
				stepCurrent: this.entities.getActiveStepIndex() + 1,
				stepCount: this.entities.getStepIds().length,
				action_running: false,
				button_status: this.button_status,
			}),
			entities: this.entities,
		})

		if (storage.type !== 'preset:button')
			throw new Error(`Invalid type given to ControlButtonPreset: "${storage.type}"`)

		this.#applyPresetModel(storage)

		this.deps.events.on('presetDrawn', this.#updateLastRender)
		this.deps.instance.definitions.on('updatePresets', this.#updatePresetDefinition)
	}

	/**
	 * Prepare this control for deletion
	 */
	destroy(): void {
		this.#drawing.dispose()
		this.entities.destroy()

		super.destroy()

		this.deps.events.off('presetDrawn', this.#updateLastRender)
		this.deps.instance.definitions.off('updatePresets', this.#updatePresetDefinition)
	}

	#entityListReportChange(options: ControlEntityListChangeProps): void {
		if (!options.noSave) {
			this.commitChange(false)
		}

		if (options.invalidateAllElements) {
			this.#drawing.clearCache()
		} else if (options.changedElementIds) {
			for (const elementId of options.changedElementIds) {
				this.#drawing.invalidateElement(elementId)
			}
		}

		if (options.redraw || options.changedElementIds || options.invalidateAllElements) {
			this.triggerInvalidation()
		}
	}

	#updateLastRender = (controlId: string, render: ImageResult): void => {
		if (controlId !== this.controlId) return
		this.#lastRender = render
	}

	#updatePresetDefinition = (connectionId: string): void => {
		if (connectionId !== this.#connectionId) return
		const updatedPreset = this.deps.instance.definitions.convertPresetToPreviewControlModel(
			this.#connectionId,
			this.#presetId
		)
		if (!updatedPreset) return // TODO - clear current preset?

		this.#applyPresetModel(updatedPreset)
	}

	#applyPresetModel(storage: PresetButtonModel): void {
		this.#drawing.loadElements(structuredClone(storage.style.layers))

		this.options = Object.assign(this.options, storage.options || {})
		this.entities.loadStorage(storage, true, true)
		this.entities.stepExpressionUpdate(this.options)

		// Ensure control is stored before setup
		setImmediate(() => this.postProcessImport())
	}

	/**
	 * If this control was imported to a running system, do some data cleanup/validation
	 */
	protected postProcessImport(): void {
		this.entities.resubscribeEntities()

		this.commitChange()
		this.sendRuntimePropsChange()
	}

	/**
	 * Collect the instance ids, labels, and variables referenced by this control
	 */
	collectReferencedConnectionsAndVariables(
		foundConnectionIds: Set<string>,
		foundConnectionLabels: Set<string>,
		foundVariables: Set<string>
	): void {
		const collector = new VisitorReferencesCollector(
			this.deps.internalModule,
			foundConnectionIds,
			foundConnectionLabels,
			foundVariables,
			undefined
		)
		this.#drawing.visit(collector)
		collector.visitEntities(this.entities.getAllEntities(), [])
	}

	/**
	 * Rename a connection for variables used in this control
	 */
	renameVariables(labelFrom: string, labelTo: string): void {
		const updater = new VisitorReferencesUpdater(
			this.deps.internalModule,
			{ [labelFrom]: labelTo },
			undefined,
			undefined
		)
		this.#drawing.visit(updater)
		const changed = updater.visitEntities(this.entities.getAllEntities(), []).recheckChangedFeedbacks().hasChanges()

		if (changed) {
			// Purge all cache, as we don't know what could have changed
			this.#drawing.clearCache()
		}

		// redraw if needed and save changes
		this.commitChange(changed)
	}

	/**
	 * Add an element to the layered style
	 */
	layeredStyleAddElement(_type: string, _index: number | null): string {
		throw new Error('ControlButtonPreset does not support mutations')
	}

	/**
	 * Remove an element from the layered style
	 */
	layeredStyleRemoveElement(_id: string): boolean {
		throw new Error('ControlButtonPreset does not support mutations')
	}

	layeredStyleDuplicateElement(_id: string): string | false {
		throw new Error('ControlButtonPreset does not support mutations')
	}

	/**
	 * Move an element in the layered style
	 */
	layeredStyleMoveElement(_id: string, _parentElementId: string | null, _newIndex: number): boolean {
		throw new Error('ControlButtonPreset does not support mutations')
	}

	/**
	 * Update the name of an element in the layered style
	 */
	layeredStyleSetElementName(_id: string, _name: string): boolean {
		throw new Error('ControlButtonPreset does not support mutations')
	}

	/**
	 * Update the usage of an element in the layered style
	 */
	layeredStyleSetElementUsage(_id: string, _name: ButtonGraphicsElementUsage): boolean {
		throw new Error('ControlButtonPreset does not support mutations')
	}

	/**
	 * Update an option on an element from the layered style
	 */
	layeredStyleUpdateOption(_id: string, _key: string, _value: ExpressionOrValue<JsonValue | undefined>): boolean {
		throw new Error('ControlButtonPreset does not support mutations')
	}

	/**
	 * Update the style from legacy properties
	 */
	layeredStyleUpdateFromLegacyProperties(_diff: Partial<ButtonStyleProperties>): boolean {
		throw new Error('ControlButtonPreset does not support mutations')
	}

	/**
	 * Get an element from the layered style by ID
	 */
	layeredStyleGetElementById(_id: string): SomeButtonGraphicsElement | undefined {
		// Streaming elements is not supported
		return undefined
	}

	layeredStyleSelectedElementIds(): { [usage in ButtonGraphicsElementUsage]: string | undefined } {
		return {
			[ButtonGraphicsElementUsage.Automatic]: undefined,
			[ButtonGraphicsElementUsage.Text]: undefined,
			[ButtonGraphicsElementUsage.Color]: undefined,
			[ButtonGraphicsElementUsage.Image]: undefined,
			[ButtonGraphicsElementUsage.Leds]: undefined,
		}
	}

	/**
	 * Convert this control to JSON
	 * To be sent to the client and written to the db
	 * @param clone - Whether to return a cloned object
	 */
	override toJSON(clone = true): PresetButtonModel {
		const obj: PresetButtonModel = {
			type: this.type,
			style: {
				layers: [...this.#drawing.drawElements],
			},
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

	readonly #renderSubscribers = new Set<string>()
	addRenderSubscriber(subscriptionId: string): void {
		this.#renderSubscribers.add(subscriptionId)
	}
	removeRenderSubscriberAndCheckEmpty(subscriptionId: string): boolean {
		this.#renderSubscribers.delete(subscriptionId)

		return this.#renderSubscribers.size === 0
	}

	triggerLocationHasChanged(): void {
		// No-op, this control does not have a location
	}

	pressControl(): void {
		// No-op, this control does not support pressing
	}
}
