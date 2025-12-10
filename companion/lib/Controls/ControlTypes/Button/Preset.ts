import { ButtonControlBase } from './Base.js'
import { VisitorReferencesUpdater } from '../../../Resources/Visitors/ReferencesUpdater.js'
import { VisitorReferencesCollector } from '../../../Resources/Visitors/ReferencesCollector.js'
import type {
	ControlWithoutActionSets,
	ControlWithoutActions,
	ControlWithStyle,
	ControlWithoutEvents,
	ControlWithEntities,
	ControlWithoutOptions,
	ControlWithoutPushed,
} from '../../IControlFragments.js'
import type {
	PresetButtonModel,
	NormalButtonOptions,
	NormalButtonRuntimeProps,
	ButtonStatus,
} from '@companion-app/shared/Model/ButtonModel.js'
import type { ButtonStyleProperties, DrawStyleButtonModel } from '@companion-app/shared/Model/StyleModel.js'
import type { ControlDependencies } from '../../ControlDependencies.js'
import { GetButtonBitmapSize } from '../../../Resources/Util.js'
import { ControlButtonNormal } from './Normal.js'
import type { ImageResult } from '../../../Graphics/ImageResult.js'
import { CreatePresetControlId } from '@companion-app/shared/ControlId.js'
import { ControlBase } from '../../ControlBase.js'
import { ControlEntityListPoolButton } from '../../Entities/EntityListPoolButton.js'
import { parseVariablesInButtonStyle } from './Util.js'

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
		ControlWithStyle,
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
	readonly supportsStyle = true
	readonly supportsLayeredStyle = false
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
	options!: NormalButtonOptions

	/**
	 * The variables referenced in the last draw. Whenever one of these changes, a redraw should be performed
	 */
	#last_draw_variables: ReadonlySet<string> | null = null

	/**
	 * The base style without feedbacks applied
	 */
	#baseStyle: ButtonStyleProperties = structuredClone(ControlButtonNormal.DefaultStyle)

	readonly #connectionId: string
	readonly #presetId: string

	#lastRender: ImageResult | null = null

	get lastRender(): ImageResult | null {
		return this.#lastRender
	}

	get baseStyle(): ButtonStyleProperties {
		return this.#baseStyle
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
					.executeExpression(expression, requiredType)
		)

		this.options = {
			...structuredClone(ButtonControlBase.DefaultOptions),
			rotaryActions: false,
			stepProgression: 'auto',
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
		this.#baseStyle = Object.assign(this.#baseStyle, storage.style || {})
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
	getBitmapSize(): { width: number; height: number } | null {
		return GetButtonBitmapSize(this.deps.userconfig, this.#baseStyle)
	}

	/**
	 * Get the complete style object of a button
	 * @returns the processed style of the button
	 */
	getDrawStyle(): DrawStyleButtonModel {
		const style = this.entities.getUnparsedFeedbackStyle(this.#baseStyle)

		this.#last_draw_variables = parseVariablesInButtonStyle(
			this.logger,
			this.controlId,
			this.deps,
			this.entities,
			style
		)

		return {
			cloud: false,
			cloud_error: false,

			...structuredClone(style),

			stepCurrent: this.entities.getActiveStepIndex() + 1,
			stepCount: this.entities.getStepIds().length,

			pushed: false,
			action_running: false,
			button_status: this.button_status,

			style: 'button',
		}
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
			.visitButtonDrawStyle(this.#baseStyle)
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
			.visitButtonDrawStyle(this.#baseStyle)
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
	 * Update the style fields of this control
	 * @param diff - config diff to apply
	 * @returns true if any changes were made
	 */
	styleSetFields(_diff: Record<string, any>): boolean {
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
			style: this.#baseStyle,
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
