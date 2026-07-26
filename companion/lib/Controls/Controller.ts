import crypto from 'node:crypto'
import { EventEmitter } from 'node:events'
import debounceFn from 'debounce-fn'
import { nanoid } from 'nanoid'
import z from 'zod'
import {
	CreateBankControlId,
	CreatePageControlId,
	CreatePresetControlId,
	CreateTriggerControlId,
	ParseControlId,
	type ParsedControlIdType,
} from '@companion-app/shared/ControlId.js'
import type { SomeButtonModel } from '@companion-app/shared/Model/ButtonModel.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import type { UIControlUpdate } from '@companion-app/shared/Model/Controls.js'
import type {
	ExpressionVariableCollection,
	ExpressionVariableModel,
} from '@companion-app/shared/Model/ExpressionVariableModel.js'
import type { PageControlModel } from '@companion-app/shared/Model/PageControlModel.js'
import type { TriggerCollection, TriggerModel } from '@companion-app/shared/Model/TriggerModel.js'
import type { VariableValues } from '@companion-app/shared/Model/Variables.js'
import { createStableObjectHash } from '@companion-app/shared/Util/Hash.js'
import type { DataDatabase } from '../Data/Database.js'
import type { CompositeElementIdString } from '../Instance/Definitions.js'
import LogController from '../Log/Controller.js'
import type { ActiveLearningStore } from '../Resources/ActiveLearningStore.js'
import { publicProcedure, router, toIterable } from '../UI/TRPC.js'
import { injectOverriddenLocalVariableValues } from '../Variables/Util.js'
import { NO_CONNECTION_LABELS } from '../Variables/Values.js'
import type { VariablesAndExpressionParser } from '../Variables/VariablesAndExpressionParser.js'
import { createActionSetsTrpcRouter } from './ActionSetsTrpcRouter.js'
import type { ControlChangeEvents, ControlCommonEvents, ControlExternalDependencies } from './ControlDependencies.js'
import type { ControlStore } from './ControlStore.js'
import { createControlsTrpcRouter } from './ControlsTrpcRouter.js'
import { ControlButtonLayered } from './ControlTypes/Button/Layered.js'
import type { ControlButtonPreset } from './ControlTypes/Button/Preset.js'
import { ControlButtonPresetReference } from './ControlTypes/Button/PresetReference.js'
import { ControlExpressionVariable } from './ControlTypes/ExpressionVariable.js'
import { ControlPage } from './ControlTypes/Page.js'
import { ControlButtonPageDown } from './ControlTypes/PageDown.js'
import { ControlButtonPageNumber } from './ControlTypes/PageNumber.js'
import { ControlButtonPageUp } from './ControlTypes/PageUp.js'
import { ControlTrigger } from './ControlTypes/Triggers/Trigger.js'
import type { ControlEntityInstance } from './Entities/EntityInstance.js'
import type { NewFeedbackValue } from './Entities/Types.js'
import { createEntitiesTrpcRouter } from './EntitiesTrpcRouter.js'
import { createEventsTrpcRouter } from './EventsTrpcRouter.js'
import { ExpressionVariableCollections } from './ExpressionVariableCollections.js'
import { ExpressionVariableNameMap } from './ExpressionVariableNameMap.js'
import { createExpressionVariableTrpcRouter } from './ExpressionVariableTrpcRouter.js'
import { ControlsFactory } from './Factory.js'
import type { SomeControl } from './IControlFragments.js'
import { createStepsTrpcRouter } from './StepsTrpcRouter.js'
import { createStylesTrpcRouter } from './StylesTrpcRouter.js'
import { TriggerCollections } from './TriggerCollections.js'
import type { TriggerEvents } from './TriggerEvents.js'
import { createTriggersTrpcRouter } from './TriggersTrpcRouter.js'
import { validateBankControlId, validateExpressionVariableControlId, validateTriggerControlId } from './Util.js'

/**
 * The class that manages the controls
 *
 * @author Håkon Nessjøen <haakon@bitfocus.io>
 * @author Keith Rocheck <keith.rocheck@gmail.com>
 * @author William Viker <william@bitfocus.io>
 * @author Julian Waller <me@julusian.co.uk>
 * @since 1.0.4
 * @copyright 2022 Bitfocus AS
 * @license
 * This program is free software.
 * You should have received a copy of the MIT licence as well as the Bitfocus
 * Individual Contributor License Agreement for Companion along with
 * this program.
 */
export class ControlsController {
	readonly #logger = LogController.createLogger('Controls/Controller')

	readonly #deps: ControlExternalDependencies
	readonly #controlEvents: EventEmitter<ControlCommonEvents>
	readonly #factory: ControlsFactory

	/**
	 * The control store (IControlStore implementation)
	 */
	readonly #store: ControlStore

	/**
	 * Active learning store
	 */
	readonly #activeLearningStore: ActiveLearningStore

	readonly #triggerCollections: TriggerCollections

	/**
	 * The expression variable collections
	 */
	readonly #expressionVariableCollections: ExpressionVariableCollections

	readonly #expressionVariableNamesMap: ExpressionVariableNameMap

	readonly #controlChangeEvents = new EventEmitter<ControlChangeEvents>()

	/** Resolve a page's local-variable entities (its `page:<pageId>` control), for `$(page:x)` injection. */
	readonly #getPageVariableEntities = (pageNumber: number): ControlEntityInstance[] | null => {
		const pageId = this.#deps.pageStore.getPageId(pageNumber)
		if (!pageId) return null

		const control = this.#store.getControl(CreatePageControlId(pageId))
		if (!control || !control.supportsEntities) return null

		return control.entities.getLocalVariableEntities()
	}

	constructor(
		db: DataDatabase,
		store: ControlStore,
		controlEvents: EventEmitter<ControlCommonEvents>,
		activeLearningStore: ActiveLearningStore,
		controlDeps: ControlExternalDependencies
	) {
		this.#store = store
		this.#deps = controlDeps
		this.#controlEvents = controlEvents
		this.#activeLearningStore = activeLearningStore

		this.#expressionVariableNamesMap = new ExpressionVariableNameMap(this.#deps.variableValues, this.#store.controls)

		this.#factory = new ControlsFactory({
			...this.#deps,
			dbTable: this.#store.dbTable,
			events: this.#controlEvents,
			changeEvents: this.#controlChangeEvents,
			getPageVariableEntities: this.#getPageVariableEntities,
			triggerEvents: this.#store.triggerEvents,
			expressionVariableNamesMap: this.#expressionVariableNamesMap,
		})

		this.#triggerCollections = new TriggerCollections(
			db,
			this.#store.triggerEvents,
			(collectionIds) => this.#cleanUnknownTriggerCollectionIds(collectionIds),
			(enabledCollectionIds) => this.#checkTriggerCollectionsEnabled(enabledCollectionIds)
		)

		this.#expressionVariableCollections = new ExpressionVariableCollections(db, (validCollectionIds) =>
			this.#cleanUnknownExpressionVariableCollectionIds(validCollectionIds)
		)
	}

	#cleanUnknownTriggerCollectionIds(validCollectionIds: ReadonlySet<string>): void {
		for (const control of this.#store.controls.values()) {
			if (control instanceof ControlTrigger) {
				control.checkCollectionIdIsValid(validCollectionIds)
			}
		}
	}

	#checkTriggerCollectionsEnabled(enabledCollectionIds: ReadonlySet<string>): void {
		for (const control of this.#store.controls.values()) {
			if (control instanceof ControlTrigger) {
				control.setCollectionEnabled(
					!control.options.collectionId || enabledCollectionIds.has(control.options.collectionId)
				)
			}
		}
	}

	#cleanUnknownExpressionVariableCollectionIds(validCollectionIds: ReadonlySet<string>): void {
		for (const control of this.#store.controls.values()) {
			if (control instanceof ControlExpressionVariable) {
				control.checkCollectionIdIsValid(validCollectionIds)
			}
		}
	}

	/**
	 * Delegation accessors for consumers that only have a ControlsController reference.
	 * The authoritative implementations live on the ControlStore.
	 */
	get triggerEvents(): TriggerEvents {
		return this.#store.triggerEvents
	}

	getControl(controlId: string): SomeControl<any> | undefined {
		return this.#store.getControl(controlId)
	}

	getAllControls(): ReadonlyMap<string, SomeControl<any>> {
		return this.#store.getAllControls()
	}

	pressControl(controlId: string, pressed: boolean, surfaceId: string | undefined, force?: boolean): boolean {
		return this.#store.pressControl(controlId, pressed, surfaceId, force)
	}

	rotateControl(controlId: string, rightward: boolean, surfaceId: string | undefined): boolean {
		return this.#store.rotateControl(controlId, rightward, surfaceId)
	}

	abortAllDelayedActions(exceptSignal: AbortSignal | null): void {
		this.#store.abortAllDelayedActions(exceptSignal)
	}

	/**
	 * Check the connection-status of every control
	 */
	checkAllStatus = debounceFn(
		(): void => {
			for (const control of this.#store.controls.values()) {
				if (typeof control.checkButtonStatus === 'function') {
					control.checkButtonStatus()
				}
			}
		},
		{
			before: false,
			after: true,
			wait: 100,
			maxWait: 500,
		}
	)

	createTrpcRouter() {
		const self = this
		return router({
			activeLearn: this.#activeLearningStore.createTrpcRouter(),
			triggers: createTriggersTrpcRouter(
				this.#controlChangeEvents,
				this.#triggerCollections,
				this.#store,
				this.#factory
			),
			expressionVariables: createExpressionVariableTrpcRouter(
				this.#controlChangeEvents,
				this.#expressionVariableCollections,
				this.#store,
				this.#expressionVariableNamesMap,
				this.#deps.instance.definitions,
				this.#factory
			),
			events: createEventsTrpcRouter(this.#store.controls, this.#deps.instance.definitions),
			entities: createEntitiesTrpcRouter(
				this.#store.controls,
				this.#deps.instance.definitions,
				this.#activeLearningStore
			),
			actionSets: createActionSetsTrpcRouter(this.#store.controls),
			steps: createStepsTrpcRouter(this.#store.controls),
			styles: createStylesTrpcRouter(this.#store.controls),

			...createControlsTrpcRouter(
				this.#logger,
				this.#store.controls,
				this.#deps.pageStore,
				this.#deps.instance.definitions,
				this.#controlEvents,
				this,
				this.#factory
			),

			watchControl: publicProcedure
				.input(
					z.object({
						controlId: z.string(),
					})
				)
				.subscription(async function* ({ input, signal }) {
					const control = self.getControl(input.controlId)
					if (!control) throw new Error(`Control ${input.controlId} not found`)

					const changes = toIterable(control.updateEvents, 'update', signal)

					yield {
						type: 'init',
						config: control.toJSON(false),
						runtime: control.toRuntimeJSON(),
					} satisfies UIControlUpdate

					for await (const [change] of changes) {
						yield change
					}
				}),
		})
	}

	/**
	 * Get all of the button controls
	 */
	getAllButtons(): Array<
		| ControlButtonLayered
		| ControlButtonPresetReference
		| ControlButtonPageDown
		| ControlButtonPageNumber
		| ControlButtonPageUp
	> {
		const buttons: Array<
			| ControlButtonLayered
			| ControlButtonPresetReference
			| ControlButtonPageDown
			| ControlButtonPageNumber
			| ControlButtonPageUp
		> = []
		for (const control of this.#store.controls.values()) {
			if (
				control instanceof ControlButtonLayered ||
				control instanceof ControlButtonPresetReference ||
				control instanceof ControlButtonPageDown ||
				control instanceof ControlButtonPageNumber ||
				control instanceof ControlButtonPageUp
			) {
				buttons.push(control)
			}
		}
		return buttons
	}

	/**
	 * Get all of the trigger controls
	 */
	getAllTriggers(): ControlTrigger[] {
		const triggers: ControlTrigger[] = []
		for (const control of this.#store.controls.values()) {
			if (control instanceof ControlTrigger) {
				triggers.push(control)
			}
		}
		return triggers
	}

	/**
	 * Get all of the expression variable controls
	 */
	getAllExpressionVariables(): ControlExpressionVariable[] {
		const variables: ControlExpressionVariable[] = []
		for (const control of this.#store.controls.values()) {
			if (control instanceof ControlExpressionVariable) {
				variables.push(control)
			}
		}
		return variables
	}

	getExpressionVariableByName(name: string): ControlExpressionVariable | undefined {
		if (!name) return undefined

		const controlId = this.#expressionVariableNamesMap.getControlIdByName(name)
		if (!controlId) return undefined

		return this.getControl(controlId) as ControlExpressionVariable | undefined
	}

	/**
	 * Get a Trigger control if it exists
	 */
	getTrigger(triggerId: string): ControlTrigger | undefined {
		const controlId = CreateTriggerControlId(triggerId)
		const control = this.#store.controls.get(controlId)
		if (!control || !(control instanceof ControlTrigger)) return undefined
		return control
	}

	/**
	 * Import a control
	 */
	importControl(location: ControlLocation, definition: SomeButtonModel, forceControlId?: string): string | null {
		if (forceControlId && !validateBankControlId(forceControlId)) {
			// Control id is not valid!
			return null
		}

		// Delete old control at the coordinate
		const oldControlId = this.#deps.pageStore.getControlIdAt(location)
		if (oldControlId) {
			this.deleteControl(oldControlId)
		}

		const newControlId = forceControlId || CreateBankControlId(nanoid())
		const newControl = this.#factory.createClassForControl(newControlId, 'button', definition, true)
		if (newControl) {
			this.#store.controls.set(newControlId, newControl)

			this.#controlEvents.emit('controlPlacedAt', location, newControlId)

			// Ensure it is stored to the db
			newControl.commitChange(true)

			return newControlId
		}

		return null
	}

	/**
	 * Import a trigger
	 */
	importTrigger(controlId: string, definition: TriggerModel): boolean {
		if (!validateTriggerControlId(controlId)) {
			// Control id is not valid!
			return false
		}

		if (this.#store.controls.has(controlId)) throw new Error(`Trigger ${controlId} already exists`)

		const newControl = this.#factory.createClassForControl(controlId, 'trigger', definition, true)
		if (newControl) {
			this.#store.controls.set(controlId, newControl)

			if (newControl instanceof ControlTrigger) {
				setImmediate(() => {
					// Ensure the trigger is enabled, on a slight debounce
					newControl.setCollectionEnabled(this.#triggerCollections.isCollectionEnabled(newControl.options.collectionId))
				})
			}

			// Ensure it is stored to the db
			newControl.commitChange()

			return true
		}

		return false
	}

	/**
	 * Import an expression variable
	 */
	importExpressionVariable(
		controlId: string,
		definition: ExpressionVariableModel
	): ControlExpressionVariable | undefined {
		if (!validateExpressionVariableControlId(controlId)) {
			// Control id is not valid!
			return undefined
		}

		if (this.#store.controls.has(controlId)) throw new Error(`ExpressionVariable ${controlId} already exists`)

		const newControl = this.#factory.createClassForControl(controlId, 'expression-variable', definition, true)
		if (newControl) {
			this.#store.controls.set(controlId, newControl)

			// Add to names map
			const expressionVariableControl = newControl as ControlExpressionVariable
			this.#expressionVariableNamesMap.addExpressionVariable(controlId, expressionVariableControl.options.variableName)

			// Ensure it is stored to the db
			newControl.commitChange()

			return newControl as ControlExpressionVariable
		}

		return undefined
	}

	/**
	 * Initialise the controls
	 */
	init(): void {
		// Init all the control classes
		const config = this.#store.dbTable.all()
		for (const [controlId, controlObj] of Object.entries(config)) {
			if (controlObj && controlObj.type) {
				const inst = this.#factory.createClassForControl(controlId, 'all', controlObj, false)
				if (inst) {
					this.#store.controls.set(controlId, inst)

					// Ensure newly loaded triggers respect their collection's enabled state
					if (inst instanceof ControlTrigger) {
						inst.setCollectionEnabled(this.#triggerCollections.isCollectionEnabled(inst.options.collectionId))
					}
				}
			}
		}

		// Ensure all collections are valid
		this.#cleanUnknownTriggerCollectionIds(this.#triggerCollections.collectAllCollectionIds())

		this.#cleanUnknownExpressionVariableCollectionIds(this.#expressionVariableCollections.collectAllCollectionIds())

		// Initialize expression variable names map
		this.#expressionVariableNamesMap.rebuildMap()
	}

	/**
	 * Propagate variable changes to the controls and triggers. `controlIdFilter` is null for a global
	 * change, or the set of controls the change is scoped to.
	 */
	onVariablesChanged(allChangedVariablesSet: ReadonlySet<string>, controlIdFilter: ReadonlySet<string> | null): void {
		this.#store.triggerEvents.emit('variables_changed', allChangedVariablesSet, controlIdFilter)

		if (allChangedVariablesSet.size > 0) {
			for (const control of this.#store.controls.values()) {
				if (controlIdFilter && !controlIdFilter.has(control.controlId)) continue

				if (control.supportsEntities) control.entities.onVariablesChanged(allChangedVariablesSet)
				control.drawing?.onVariablesChanged(allChangedVariablesSet)
			}
		}
	}

	/**
	 * A control moved to a different page, so its `$(page:x)` references now resolve against a different
	 * page control - re-evaluate its page-variable feedbacks. No-op if the page is unchanged.
	 */
	notifyControlMovedPage(controlId: string, fromPageNumber: number, toPageNumber: number): void {
		const fromPageId = this.#deps.pageStore.getPageId(fromPageNumber)
		const toPageId = this.#deps.pageStore.getPageId(toPageNumber)
		if (!fromPageId || !toPageId || fromPageId === toPageId) return

		const changed = new Set<string>()
		for (const pageNumber of [fromPageNumber, toPageNumber]) {
			for (const entity of this.#getPageVariableEntities(pageNumber) ?? []) {
				const name = entity.rawLocalVariableName
				if (name) changed.add(`page:${name}`)
			}
		}
		if (changed.size === 0) return

		this.#deps.variableValues.emit('variablesChanged', changed, NO_CONNECTION_LABELS, controlId)
	}

	/**
	 * Propagate composite element changes
	 * @param allChangedElementIds - composite element ids with changes
	 */
	onCompositeElementsChanged(allChangedElementIds: ReadonlySet<CompositeElementIdString>): void {
		if (allChangedElementIds.size === 0) return

		for (const control of this.#store.controls.values()) {
			control.drawing?.onCompositeElementsChanged(allChangedElementIds)
		}
	}

	/**
	 * Delete a control
	 */
	deleteControl(controlId: string): void {
		const control = this.getControl(controlId)
		if (control) {
			control.destroy()

			this.#store.deleteControl(controlId)
		}

		const location = this.#deps.pageStore.getLocationOfControlId(controlId)
		if (location) {
			this.#controlEvents.emit('controlRemovedFrom', location)

			// Notify interested parties
			this.#controlEvents.emit('updateButtonState', location, false, undefined)

			// Force a redraw
			this.#controlEvents.emit('invalidateLocationRender', location)
		}

		// Notify that control count has changed
		this.#controlEvents.emit('controlCountChanged')
	}

	/**
	 * Delete every control whose id is of the given type (see {@link ParseControlId})
	 *
	 * This parses the ids to ensure it is exhaustive and not relying on specific implementations of each type
	 */
	deleteAllControlsOfType(type: ParsedControlIdType['type']): void {
		for (const controlId of this.#store.controls.keys()) {
			if (ParseControlId(controlId)?.type === type) {
				this.deleteControl(controlId)
			}
		}
	}

	exportTriggerCollections(): TriggerCollection[] {
		return this.#triggerCollections.collectionData
	}

	replaceTriggerCollections(collections: TriggerCollection[]): void {
		this.#triggerCollections.replaceCollections(collections)
	}

	exportExpressionVariableCollections(): ExpressionVariableCollection[] {
		return this.#expressionVariableCollections.collectionData
	}

	replaceExpressionVariableCollections(collections: ExpressionVariableCollection[]): void {
		this.#expressionVariableCollections.replaceCollections(collections)
	}

	/**
	 * Create a control
	 * Danger: This will not delete an existing control from the specified location
	 * @param location Location to place in the grid
	 * @param newType The type of the new control to create (if any)
	 * @returns controlId
	 * @access public
	 */
	createButtonControl(location: ControlLocation, newType: string): string | null {
		if (!this.#deps.pageStore.isPageValid(location.pageNumber)) return null

		const controlId = CreateBankControlId(nanoid())
		const newControl = this.#factory.createClassForControl(controlId, 'button', newType, false)
		if (!newControl) return null

		this.#store.controls.set(controlId, newControl)
		this.#controlEvents.emit('controlPlacedAt', location, controlId)

		// Notify interested parties
		this.#controlEvents.emit('updateButtonState', location, false, undefined)

		// Force a redraw
		this.#controlEvents.emit('invalidateLocationRender', location)

		// Notify that control count has changed
		this.#controlEvents.emit('controlCountChanged')

		return controlId
	}

	/**
	 * Create (or import) the page control that owns a page's local variables.
	 * There is exactly one per page, keyed by the page's stable id. Safe to call for a page that already
	 * has one during reconciliation (it becomes a no-op unless a `storage` model is given to import).
	 * @param pageId Stable id of the page
	 * @param storage Persisted model to import, or null/undefined to create an empty one
	 * @param isImport Whether this is an import, and needs additional processing
	 * @returns the page controlId
	 */
	createPageControl(pageId: string, storage?: PageControlModel | null, isImport = false): string {
		const controlId = CreatePageControlId(pageId)

		const existing = this.#store.getControl(controlId)
		if (existing) {
			// Nothing to do during reconciliation if we're not importing new data
			if (!storage) return controlId

			// Replace the existing control with the imported data
			this.deleteControl(controlId)
		}

		const newControl = this.#factory.createClassForControl(controlId, 'all', storage ?? 'page', isImport)
		if (!newControl) throw new Error(`Failed to create page control for page "${pageId}"`)

		this.#store.controls.set(controlId, newControl)

		return controlId
	}

	/**
	 * Clear all of a page's local variables (used when the page is wiped). No-op if the page has no
	 * page control (e.g. it was already deleted).
	 */
	clearPageVariables(pageId: string): void {
		const control = this.#store.getControl(CreatePageControlId(pageId))
		if (control instanceof ControlPage) control.clearVariables()
	}

	setTriggerCollectionEnabled(collectionId: string, enabled: boolean | 'toggle'): void {
		this.#triggerCollections.setCollectionEnabled(collectionId, enabled)
	}
	isTriggerCollectionEnabled(collectionId: string, onlyDirect: boolean): boolean {
		return this.#triggerCollections.isCollectionEnabled(collectionId, onlyDirect)
	}

	/**
	 * Find or create a preset temporary control
	 * These are non-persistent controls that are used to perform the reactive drawing of a preset.
	 */
	getOrCreatePresetControl(
		connectionId: string,
		presetId: string,
		variableValues: VariableValues | null
	): ControlButtonPreset | null {
		let presetModel = this.#deps.instance.definitions.convertPresetToPreviewControlModel(connectionId, presetId)
		if (!presetModel) return null

		// Interleave the values into the preset
		let usedVariableValues: VariableValues | undefined
		if (variableValues) {
			presetModel = {
				...presetModel,
				localVariables: structuredClone(presetModel.localVariables),
			}

			usedVariableValues = injectOverriddenLocalVariableValues(presetModel.localVariables, variableValues)
		}

		const variablesHash =
			usedVariableValues && Object.keys(usedVariableValues).length > 0
				? crypto.createHash('sha256').update(createStableObjectHash(usedVariableValues)).digest('hex')
				: 'default'

		// Check for an existing control that should be reused
		const controlId = CreatePresetControlId(connectionId, presetId, variablesHash)
		const control = this.#store.controls.get(controlId)
		if (control) return control as ControlButtonPreset

		const newControl = this.#factory.createPresetControl(connectionId, presetId, variablesHash, presetModel)

		this.#store.controls.set(controlId, newControl)

		// Force a redraw
		this.#controlEvents.emit('invalidateControlRender', controlId)

		return newControl
	}

	/**
	 * Update values for some feedbacks
	 * @param connectionId
	 * @param result - object containing new values for the feedbacks that have changed
	 */
	updateFeedbackValues(connectionId: string, result: NewFeedbackValue[]): void {
		this.#store.updateFeedbackValues(connectionId, result)
	}

	/**
	 * Prune any items on controls which belong to an unknown connectionId
	 * @access public
	 */
	verifyConnectionIds(knownConnectionIds: ReadonlySet<string>): void {
		for (const control of this.#store.controls.values()) {
			if (!control.supportsEntities) continue
			control.entities.verifyConnectionIds(knownConnectionIds)
		}
	}

	createVariablesAndExpressionParser(
		controlId: string | null | undefined,
		overrideVariableValues?: VariableValues | null
	): VariablesAndExpressionParser {
		return this.#store.createVariablesAndExpressionParser(controlId, overrideVariableValues ?? null)
	}
}
