import type { JsonValue } from 'type-fest'
import type {
	LayeredButtonModel,
	LayeredButtonOptions,
	NormalButtonRuntimeProps,
	PresetReferenceButtonModel,
} from '@companion-app/shared/Model/ButtonModel.js'
import type { VariableValue, VariableValues } from '@companion-app/shared/Model/Variables.js'
import { VisitorReferencesCollector } from '../../../Resources/Visitors/ReferencesCollector.js'
import { VisitorReferencesUpdater } from '../../../Resources/Visitors/ReferencesUpdater.js'
import type { ControlDependencies } from '../../ControlDependencies.js'
import type { ControlStepsRuntimeManager } from '../../Entities/ControlActionSetAndStepsManager.js'
import type { ControlEntityListChangeProps } from '../../Entities/EntityListPoolBase.js'
import { ControlEntityListPoolButton } from '../../Entities/EntityListPoolButton.js'
import type {
	ControlWithActions,
	ControlWithActionSets,
	ControlWithConvert,
	ControlWithOptions,
	ControlWithoutEvents,
	ControlWithoutLayeredStyle,
} from '../../IControlFragments.js'
import { ButtonControlRuntimeBase } from './Base.js'
import { LayeredButtonDrawer } from './LayeredButtonDrawer.js'

/**
 * Class for a button control that references a preset from a connection.
 *
 * It behaves like a normal layered button at runtime (it can be pressed, run actions, render feedbacks and
 * progress steps), but its configuration is a cached copy of the source preset and is read-only. It composes
 * the plain {@link LayeredButtonDrawer} (not the editor subclass), so it has no way to mutate its style; the
 * entity pool is likewise constructed read-only. When the source preset definition updates, the cached data
 * is refreshed, re-applying any user-edited templated variable values. An 'Edit' action in the UI converts it
 * into a normal `button-layered` control via {@link convertControl}.
 *
 * @author Julian Waller <me@julusian.co.uk>
 * @since 5.0.0
 * @copyright 2026 Bitfocus AS
 * @license
 * This program is free software.
 * You should have received a copy of the MIT licence as well as the Bitfocus
 * Individual Contributor License Agreement for Companion along with
 * this program.
 */
export class ControlButtonPresetReference
	extends ButtonControlRuntimeBase<PresetReferenceButtonModel, LayeredButtonOptions, ControlEntityListPoolButton>
	implements
		ControlWithoutLayeredStyle,
		ControlWithActions,
		ControlWithoutEvents,
		ControlWithActionSets,
		ControlWithOptions,
		ControlWithConvert
{
	readonly type = 'preset-reference'

	readonly supportsActions = true
	readonly supportsEvents = false
	readonly supportsActionSets = true
	readonly supportsLayeredStyle = false
	readonly supportsOptions = true
	readonly supportsConvert = true

	/** The composed (read-only) layered rendering. There is no editing surface on this drawer. */
	readonly #drawing: LayeredButtonDrawer
	override get drawing(): LayeredButtonDrawer {
		return this.#drawing
	}

	/**
	 * The reference to the source preset, and the user-editable templated variable overrides.
	 * `#connectionId`/`#moduleId` are mutable because the reference can be switched to another connection
	 * of the same module.
	 */
	#connectionId: string
	#moduleId: string
	readonly #presetId: string
	#variableValues: VariableValues | null

	get actionSets(): ControlStepsRuntimeManager {
		return this.entities
	}

	get connectionId(): string {
		return this.#connectionId
	}
	get moduleId(): string {
		return this.#moduleId
	}
	get presetId(): string {
		return this.#presetId
	}

	constructor(deps: ControlDependencies, controlId: string, storage: PresetReferenceButtonModel, isImport: boolean) {
		super(deps, controlId, `Controls/Button/PresetReference/${controlId}`, true, ControlEntityListPoolButton)

		if (storage.type !== 'preset-reference')
			throw new Error(`Invalid type given to ControlButtonPresetReference: "${storage.type}"`)

		this.#connectionId = storage.presetRef.connectionId
		this.#moduleId = storage.presetRef.moduleId
		this.#presetId = storage.presetRef.presetId
		this.#variableValues = storage.presetRef.variableValues

		this.options = {
			...structuredClone(ButtonControlRuntimeBase.DefaultOptions),
			rotaryActions: false,
			canModifyStyleInApis: false,
			notes: '',
		}

		this.#drawing = new LayeredButtonDrawer(deps, controlId, {
			getButtonStateProps: () => this.getDrawStyleButtonStateProps(),
			entities: this.entities,
		})

		this.#loadModel(storage, isImport)

		// Refresh the cached data whenever the source preset definitions change
		this.deps.instance.definitions.on('updatePresets', this.#onPresetUpdate)
	}

	/**
	 * Prepare this control for deletion
	 */
	destroy(): void {
		this.deps.instance.definitions.off('updatePresets', this.#onPresetUpdate)
		this.drawing.dispose()
		super.destroy()
	}

	/**
	 * Apply a (cached) model to this control. Used on construction, on preset updates and on templated edits.
	 */
	#loadModel(storage: PresetReferenceButtonModel, isImport: boolean): void {
		this.drawing.loadElements(storage.style.layers)
		this.options = Object.assign(this.options, storage.options || {})
		this.entities.setupRotaryActionSets(!!this.options.rotaryActions, true)
		this.entities.loadStorage(storage, true, isImport)
		this.entities.stepExpressionUpdate(this.options)

		// Ensure control is stored before setup
		if (isImport) setImmediate(() => this.postProcessImport())
	}

	/**
	 * The source preset definitions changed - refresh the cached data, preserving the user's templated values.
	 * If the preset no longer exists, keep the last-known data.
	 */
	#onPresetUpdate = (connectionId: string): void => {
		if (connectionId !== this.#connectionId) return

		const updatedModel = this.deps.instance.definitions.convertPresetToReferenceControlModel(
			this.#connectionId,
			this.#presetId,
			this.#variableValues
		)
		if (!updatedModel) return // Preset is gone - keep the last-known cached data

		this.#applyUpdatedModel(updatedModel)
	}

	/**
	 * Replace the cached data with a freshly built model and persist+redraw
	 */
	#applyUpdatedModel(updatedModel: PresetReferenceButtonModel): void {
		// Keep the reference metadata in sync (module-id, and connection-id when switched)
		this.#connectionId = updatedModel.presetRef.connectionId
		this.#moduleId = updatedModel.presetRef.moduleId

		this.drawing.loadElements(updatedModel.style.layers)
		// `notes` is user-owned metadata, not part of the preset - preserve it across preset refreshes
		const userNotes = this.options.notes
		this.options = Object.assign(this.options, updatedModel.options || {})
		this.options.notes = userNotes
		this.entities.setupRotaryActionSets(!!this.options.rotaryActions, true)
		this.entities.loadStorage(updatedModel, false, false)
		this.entities.stepExpressionUpdate(this.options)
		this.entities.resubscribeEntities()

		this.commitChange(true)
		this.sendRuntimePropsChange()
	}

	/**
	 * Get the names of the templated variables the user is allowed to edit on this reference
	 */
	getTemplateVariableNames(): string[] {
		return this.#variableValues ? Object.keys(this.#variableValues) : []
	}

	/**
	 * Update a single templated variable value. Only variables that were templated (present in the override
	 * map) may be edited. The override is re-applied on top of the source preset, so it survives future
	 * preset updates.
	 */
	setTemplateVariableValue(variableName: string, value: VariableValue | undefined): boolean {
		if (!this.#variableValues || !(variableName in this.#variableValues)) return false

		this.#variableValues = { ...this.#variableValues, [variableName]: value }

		const updatedModel = this.deps.instance.definitions.convertPresetToReferenceControlModel(
			this.#connectionId,
			this.#presetId,
			this.#variableValues
		)
		if (updatedModel) {
			this.#applyUpdatedModel(updatedModel)
		} else {
			// Source preset is gone - persist the new override anyway so it isn't lost
			this.commitChange(true)
		}

		return true
	}

	/**
	 * Switch the reference to point at another connection (intended to be one of the same module). The preset
	 * is re-resolved from the new connection, re-applying the templated variable overrides. Returns false if
	 * the new connection does not provide this preset.
	 */
	setReferencedConnection(connectionId: string): boolean {
		if (connectionId === this.#connectionId) return true

		const updatedModel = this.deps.instance.definitions.convertPresetToReferenceControlModel(
			connectionId,
			this.#presetId,
			this.#variableValues
		)
		if (!updatedModel) return false

		this.#applyUpdatedModel(updatedModel)

		return true
	}

	/**
	 * Update an option field. A reference is read-only except for its user notes (which are user-owned
	 * metadata, not part of the preset, and are preserved across preset updates). Any other option is
	 * rejected - so a reference stays read-only even as new option fields are added in the future.
	 */
	optionsSetField(key: string, value: JsonValue): boolean {
		if (key !== 'notes' || typeof value !== 'string') return false

		this.options.notes = value
		this.commitChange(false)
		return true
	}

	/**
	 * Convert this control to a normal editable layered button, baking the current (cached + templated)
	 * state into a plain model. After this, the link to the source preset is gone.
	 */
	convertControl(): LayeredButtonModel {
		return {
			type: 'button-layered',
			style: { layers: structuredClone([...this.drawing.drawElements]) },
			options: structuredClone(this.options),
			feedbacks: this.entities.getFeedbackEntities(),
			steps: this.entities.asNormalButtonSteps(),
			localVariables: this.entities.getLocalVariableEntities().map((ent) => ent.asEntityModel(true)),
		}
	}

	protected entityListReportChange(options: ControlEntityListChangeProps): void {
		if (!options.noSave) {
			this.commitChange(false)
		}
		if (options.invalidateAllElements) {
			this.drawing.clearCache()
		} else if (options.changedElementIds) {
			for (const elementId of options.changedElementIds) {
				this.drawing.invalidateElement(elementId)
			}
		}

		if (options.redraw || options.changedElementIds || options.invalidateAllElements) {
			this.triggerInvalidation()
		}
	}

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
		collector.visitEntities(this.entities.getAllEntities(), [])
		this.drawing.visit(collector)
	}

	triggerLocationHasChanged(): void {
		super.triggerLocationHasChanged()

		this.drawing.locationChanged()
	}

	renameVariables(labelFrom: string, labelTo: string): void {
		const updater = new VisitorReferencesUpdater(
			this.deps.internalModule,
			{ [labelFrom]: labelTo },
			undefined,
			undefined
		)
		updater.visitEntities(this.entities.getAllEntities(), [])
		this.drawing.visit(updater)
		const changed = updater.recheckChangedFeedbacks().hasChanges()

		if (changed) {
			this.drawing.clearCache()
		}

		this.commitChange(changed)
	}

	/**
	 * Convert this control to JSON
	 * To be sent to the client and written to the db
	 */
	override toJSON(clone = true): PresetReferenceButtonModel {
		const obj: PresetReferenceButtonModel = {
			type: this.type,
			style: { layers: [...this.drawing.drawElements] },
			options: this.options,
			feedbacks: this.entities.getFeedbackEntities(),
			steps: this.entities.asNormalButtonSteps(),
			localVariables: this.entities.getLocalVariableEntities().map((ent) => ent.asEntityModel(true)),
			presetRef: {
				connectionId: this.#connectionId,
				moduleId: this.#moduleId,
				presetId: this.#presetId,
				variableValues: this.#variableValues,
			},
		}

		return clone ? structuredClone(obj) : obj
	}

	override toRuntimeJSON(): NormalButtonRuntimeProps {
		return {
			current_step_id: this.entities.currentStepId,
		}
	}
}
