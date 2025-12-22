import { ButtonControlBase } from './Base.js'
import { VisitorReferencesUpdater } from '../../../Resources/Visitors/ReferencesUpdater.js'
import { VisitorReferencesCollector } from '../../../Resources/Visitors/ReferencesCollector.js'
import type {
	ControlWithoutActionSets,
	ControlWithoutActions,
	ControlWithoutEvents,
	ControlWithEntities,
	ControlWithoutOptions,
	ControlWithoutPushed,
	ControlWithLayeredStyle,
	ControlWithoutStyle,
} from '../../IControlFragments.js'
import type {
	PresetButtonModel,
	LayeredButtonOptions,
	NormalButtonRuntimeProps,
	ButtonStatus,
} from '@companion-app/shared/Model/ButtonModel.js'
import type { ButtonStyleProperties, DrawStyleLayeredButtonModel } from '@companion-app/shared/Model/StyleModel.js'
import type { ControlDependencies } from '../../ControlDependencies.js'
import type { ImageResult } from '../../../Graphics/ImageResult.js'
import { CreatePresetControlId } from '@companion-app/shared/ControlId.js'
import { ControlBase } from '../../ControlBase.js'
import { ControlEntityListPoolButton } from '../../Entities/EntityListPoolButton.js'
import type {
	ButtonGraphicsElementUsage,
	SomeButtonGraphicsElement,
} from '@companion-app/shared/Model/StyleLayersModel.js'
import { ConvertSomeButtonGraphicsElementForDrawing } from '../../../Graphics/ConvertGraphicsElements.js'

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
		ControlWithoutStyle,
		ControlWithLayeredStyle,
		ControlWithoutActions,
		ControlWithoutEvents,
		ControlWithoutActionSets,
		ControlWithEntities,
		ControlWithoutOptions,
		ControlWithoutPushed
{
	readonly type = 'preset:button'

	readonly supportsActions = false
	readonly supportsEvents = false
	readonly supportsActionSets = false
	readonly supportsStyle = false
	readonly supportsLayeredStyle = true
	readonly supportsEntities = true
	readonly supportsOptions = false
	readonly supportsPushed = false

	readonly entities: ControlEntityListPoolButton

	/**
	 * The current status of this button
	 */
	readonly button_status: ButtonStatus = 'good'

	/**
	 * The config of this button
	 */
	options!: LayeredButtonOptions

	/**
	 * The variables referenced in the last draw. Whenever one of these changes, a redraw should be performed
	 */
	#last_draw_variables: ReadonlySet<string> | null = null

	/**
	 * The base style without feedbacks applied
	 */
	#drawElements: SomeButtonGraphicsElement[] = []

	readonly #connectionId: string
	readonly #presetId: string

	#lastRender: ImageResult | null = null

	get lastRender(): ImageResult | null {
		return this.#lastRender
	}

	constructor(deps: ControlDependencies, connectionId: string, presetId: string, storage: PresetButtonModel) {
		const controlId = CreatePresetControlId(connectionId, presetId)
		super(deps, controlId, `Controls/Button/Preset/${connectionId}/${presetId}`, true)

		this.#connectionId = connectionId
		this.#presetId = presetId

		this.entities = new ControlEntityListPoolButton(
			{
				controlId,
				commitChange: this.commitChange.bind(this),
				invalidateControl: this.triggerRedraw.bind(this),
				instanceDefinitions: deps.instance.definitions,
				internalModule: deps.internalModule,
				processManager: deps.instance.processManager,
				variableValues: deps.variables.values,
			},
			this.sendRuntimePropsChange.bind(this),
			(expression, requiredType, injectedVariableValues) =>
				deps.variables.values
					.createVariablesAndExpressionParser(
						deps.pageStore.getLocationOfControlId(this.controlId),
						null, // This doesn't support local variables
						injectedVariableValues ?? null
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
		this.entities.destroy()

		super.destroy()

		this.deps.events.off('presetDrawn', this.#updateLastRender)
		this.deps.instance.definitions.off('updatePresets', this.#updatePresetDefinition)
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
		this.#drawElements = storage.style.layers || []
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
	 * Get the size of the bitmap render of this control
	 */
	getBitmapFeedbackSize(): { width: number; height: number } | null {
		// TODO-layered: implement this
		return null
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
		const parser = this.deps.variables.values.createVariablesAndExpressionParser(
			null,
			this.entities.getLocalVariableEntities(),
			null
		)

		const feedbackOverrides = this.entities.getFeedbackStyleOverrides()

		// Compute the new drawing
		const { elements, usedVariables } = await ConvertSomeButtonGraphicsElementForDrawing(
			parser,
			this.deps.graphics.renderPixelBuffers.bind(this.deps.graphics),
			this.#drawElements,
			feedbackOverrides,
			true
		)
		this.#last_draw_variables = usedVariables.size > 0 ? usedVariables : null

		const result: DrawStyleLayeredButtonModel = {
			cloud: false,
			cloud_error: false,

			elements,

			stepCurrent: this.entities.getActiveStepIndex() + 1,
			stepCount: this.entities.getStepIds().length,

			pushed: false,
			action_running: false,
			button_status: this.button_status,

			style: 'button-layered',
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
		new VisitorReferencesCollector(this.deps.internalModule, foundConnectionIds, foundConnectionLabels, foundVariables)
			.visitDrawElements(this.#drawElements)
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
			.visitDrawElements(this.#drawElements)
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
	 * Add an element to the layered style
	 * @param _type Element type to add
	 * @param _index Index to insert the element at, or null to append
	 */
	layeredStyleAddElement(_type: string, _index: number | null): string {
		throw new Error('ControlButtonPreset does not support mutations')
	}

	/**
	 * Remove an element from the layered style
	 * @param _id Element id to remove
	 * @returns true if the element was removed
	 */
	layeredStyleRemoveElement(_id: string): boolean {
		throw new Error('ControlButtonPreset does not support mutations')
	}

	/**
	 * Move an element in the layered style
	 * @param _id Element id to move
	 * @param _parentElementId Parent element id to move the element to
	 * @param _newIndex New index of the element
	 * @returns true if the element was moved
	 */
	layeredStyleMoveElement(_id: string, _parentElementId: string | null, _newIndex: number): boolean {
		throw new Error('ControlButtonPreset does not support mutations')
	}

	/**
	 * Update the name of an element in the layered style
	 * @param _id Element id to update
	 * @param _name New name for the element
	 * @returns true if the element was updated
	 */
	layeredStyleSetElementName(_id: string, _name: string): boolean {
		throw new Error('ControlButtonPreset does not support mutations')
	}

	/**
	 * Update the usage of an element in the layered style
	 * @param _id Element id to update
	 * @param usage New usage for the element
	 * @returns true if the element was updated
	 */
	layeredStyleSetElementUsage(_id: string, _name: ButtonGraphicsElementUsage): boolean {
		throw new Error('ControlButtonPreset does not support mutations')
	}

	/**
	 * Update an option on an element from the layered style
	 * @param _id Element id to update
	 * @param _key Option key to update
	 * @param _value New value for the option
	 * @returns true if any changes were made
	 */
	// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
	layeredStyleUpdateOptionValue(_id: string, _key: string, _value: any): boolean {
		throw new Error('ControlButtonPreset does not support mutations')
	}

	/**
	 * Update whether option on an element from the layered style is an expression
	 * @param _id Element id to update
	 * @param _key Option key to update
	 * @param _value Whether the value should be an expression
	 * @returns true if any changes were made
	 */
	layeredStyleUpdateOptionIsExpression(_id: string, _key: string, _value: boolean): boolean {
		throw new Error('ControlButtonPreset does not support mutations')
	}

	/**
	 * Update the style from legacy properties
	 * Future: Once the old button style is removed, this should be reworked to utilise the new style system better
	 * @param _diff The properties to update
	 * @returns true if any changes were made
	 */
	layeredStyleUpdateFromLegacyProperties(_diff: Partial<ButtonStyleProperties>): boolean {
		throw new Error('ControlButtonPreset does not support mutations')
	}

	/**
	 * Get an element from the layered style by ID
	 * @param _id Element ID to find
	 * @returns The element if found, undefined otherwise
	 */
	layeredStyleGetElementById(_id: string): SomeButtonGraphicsElement | undefined {
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
			style: {
				layers: this.#drawElements,
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
