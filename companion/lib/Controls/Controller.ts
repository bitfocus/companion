import { ControlButtonNormal } from './ControlTypes/Button/Normal.js'
import { ControlButtonPageDown } from './ControlTypes/PageDown.js'
import { ControlButtonPageNumber } from './ControlTypes/PageNumber.js'
import { ControlButtonPageUp } from './ControlTypes/PageUp.js'
import { CreateBankControlId, CreateTriggerControlId } from '@companion-app/shared/ControlId.js'
import { ActionRunner } from './ActionRunner.js'
import { ActionRecorder } from './ActionRecorder.js'
import { ControlTrigger } from './ControlTypes/Triggers/Trigger.js'
import { nanoid } from 'nanoid'
import { TriggerEvents } from './TriggerEvents.js'
import debounceFn from 'debounce-fn'
import type { SomeButtonModel } from '@companion-app/shared/Model/ButtonModel.js'
import type { TriggerCollection, TriggerModel } from '@companion-app/shared/Model/TriggerModel.js'
import type { SomeControl } from './IControlFragments.js'
import type { Registry } from '../Registry.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import { EventEmitter } from 'events'
import type { ControlChangeEvents, ControlCommonEvents, ControlDependencies } from './ControlDependencies.js'
import LogController from '../Log/Controller.js'
import { DataStoreTableView } from '../Data/StoreBase.js'
import { TriggerCollections } from './TriggerCollections.js'
import { publicProcedure, router, toIterable } from '../UI/TRPC.js'
import { createTriggersTrpcRouter } from './TriggersTrpcRouter.js'
import { validateBankControlId, validateTriggerControlId } from './Util.js'
import { createEventsTrpcRouter } from './EventsTrpcRouter.js'
import { createStepsTrpcRouter } from './StepsTrpcRouter.js'
import { ActiveLearningStore } from '../Resources/ActiveLearningStore.js'
import { createEntitiesTrpcRouter } from './EntitiesTrpcRouter.js'
import { createActionSetsTrpcRouter } from './ActionSetsTrpcRouter.js'
import { createControlsTrpcRouter } from './ControlsTrpcRouter.js'
import z from 'zod'
import { SomeControlModel, UIControlUpdate } from '@companion-app/shared/Model/Controls.js'

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

	readonly #registry: Pick<
		Registry,
		'db' | 'page' | 'ui' | 'graphics' | 'surfaces' | 'internalModule' | 'instance' | 'variables' | 'userconfig'
	>
	readonly #controlEvents: EventEmitter<ControlCommonEvents>

	/**
	 * Actions runner
	 */
	readonly actionRunner: ActionRunner

	/**
	 * Actions recorder
	 */
	readonly actionRecorder: ActionRecorder

	/**
	 * The currently configured controls
	 */
	readonly #controls = new Map<string, SomeControl<any>>()

	/**
	 * Triggers events
	 */
	readonly triggers: TriggerEvents

	/**
	 * Active learning store
	 */
	readonly #activeLearningStore = new ActiveLearningStore()

	readonly #dbTable: DataStoreTableView<Record<string, SomeControlModel>>

	readonly #triggerCollections: TriggerCollections

	readonly #controlChangeEvents = new EventEmitter<ControlChangeEvents>()

	constructor(registry: Registry, controlEvents: EventEmitter<ControlCommonEvents>) {
		this.#registry = registry
		this.#controlEvents = controlEvents

		this.#dbTable = registry.db.getTableView('controls')

		this.triggers = new TriggerEvents()
		this.#triggerCollections = new TriggerCollections(
			registry.db,
			this.triggers,
			(collectionIds) => this.#cleanUnknownTriggerCollectionIds(collectionIds),
			(enabledCollectionIds) => this.#checkTriggerCollectionsEnabled(enabledCollectionIds)
		)

		this.actionRunner = new ActionRunner(registry)
		this.actionRecorder = new ActionRecorder(registry)
	}

	#cleanUnknownTriggerCollectionIds(validCollectionIds: Set<string>): void {
		for (const control of this.#controls.values()) {
			if (control instanceof ControlTrigger) {
				control.checkCollectionIdIsValid(validCollectionIds)
			}
		}
	}

	#checkTriggerCollectionsEnabled(enabledCollectionIds: ReadonlySet<string>): void {
		for (const control of this.#controls.values()) {
			if (control instanceof ControlTrigger) {
				control.setCollectionEnabled(
					!control.options.collectionId || enabledCollectionIds.has(control.options.collectionId)
				)
			}
		}
	}

	/**
	 * Abort all delayed actions across all controls
	 */
	abortAllDelayedActions(exceptSignal: AbortSignal | null): void {
		for (const control of this.#controls.values()) {
			if (control.supportsActions) {
				control.abortDelayedActions(false, exceptSignal)
			}
		}
	}

	#createControlDependencies(): ControlDependencies {
		// This has to be done lazily for now, as the registry is not fully populated at the time of construction
		return {
			dbTable: this.#dbTable,
			graphics: this.#registry.graphics,
			surfaces: this.#registry.surfaces,
			page: this.#registry.page,
			internalModule: this.#registry.internalModule,
			instance: this.#registry.instance,
			variables: this.#registry.variables,
			userconfig: this.#registry.userconfig,
			actionRunner: this.actionRunner,
			events: this.#controlEvents,
			changeEvents: this.#controlChangeEvents,
		}
	}

	/**
	 * Check the connection-status of every control
	 */
	checkAllStatus = debounceFn(
		(): void => {
			for (const control of this.#controls.values()) {
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

	/**
	 * Remove any tracked state for a connection
	 */
	clearConnectionState(connectionId: string): void {
		for (const control of this.#controls.values()) {
			if (control.supportsEntities) {
				control.clearConnectionState(connectionId)
			}
		}
	}

	createTrpcRouter() {
		const self = this
		return router({
			activeLearn: this.#activeLearningStore.createTrpcRouter(),
			triggers: createTriggersTrpcRouter(
				this.#controlChangeEvents,
				this.#triggerCollections,
				this.#dbTable,
				this.#controls,
				this.triggers,
				this.#createControlDependencies()
			),
			events: createEventsTrpcRouter(this.#controls, this.#registry.instance.definitions),
			entities: createEntitiesTrpcRouter(
				this.#controls,
				this.#registry.instance.definitions,
				this.#activeLearningStore
			),
			actionSets: createActionSetsTrpcRouter(this.#controls),
			steps: createStepsTrpcRouter(this.#controls),

			...createControlsTrpcRouter(
				this.#logger,
				this.#controls,
				this.#registry.page,
				this.#registry.instance.definitions,
				this.#registry.graphics,
				this
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
	 * Create a new control class instance
	 * TODO: This should be private
	 * @param controlId Id of the control
	 * @param category 'button' | 'trigger' | 'all'
	 * @param controlObj The existing configuration of the control, or string type if it is a new control. Note: the control must be given a clone of an object
	 * @param isImport Whether this is an import, and needs additional processing
	 */
	createClassForControl(
		controlId: string,
		category: 'button' | 'trigger' | 'all',
		controlObj: SomeControlModel | string,
		isImport: boolean
	): SomeControl<any> | null {
		const controlType = typeof controlObj === 'object' ? controlObj.type : controlObj
		const controlObj2 = typeof controlObj === 'object' ? controlObj : null
		if (category === 'all' || category === 'button') {
			if (controlObj2?.type === 'button' || (controlType === 'button' && !controlObj2)) {
				return new ControlButtonNormal(this.#createControlDependencies(), controlId, controlObj2, isImport)
			} else if (controlObj2?.type === 'pagenum' || (controlType === 'pagenum' && !controlObj2)) {
				return new ControlButtonPageNumber(this.#createControlDependencies(), controlId, controlObj2, isImport)
			} else if (controlObj2?.type === 'pageup' || (controlType === 'pageup' && !controlObj2)) {
				return new ControlButtonPageUp(this.#createControlDependencies(), controlId, controlObj2, isImport)
			} else if (controlObj2?.type === 'pagedown' || (controlType === 'pagedown' && !controlObj2)) {
				return new ControlButtonPageDown(this.#createControlDependencies(), controlId, controlObj2, isImport)
			}
		}

		if (category === 'all' || category === 'trigger') {
			if (controlObj2?.type === 'trigger' || (controlType === 'trigger' && !controlObj2)) {
				const trigger = new ControlTrigger(
					this.#createControlDependencies(),
					this.triggers,
					controlId,
					controlObj2,
					isImport
				)
				setImmediate(() => {
					// Ensure the trigger is enabled, on a slight debounce
					trigger.setCollectionEnabled(this.#triggerCollections.isCollectionEnabled(trigger.options.collectionId))
				})
				return trigger
			}
		}

		// Unknown type
		this.#logger.warn(`Cannot create control "${controlId}" of unknown type "${controlType}"`)
		return null
	}

	/**
	 * Update all controls to forget a connection
	 */
	forgetConnection(connectionId: string): void {
		for (const control of this.#controls.values()) {
			if (control.supportsEntities) {
				control.forgetConnection(connectionId)
			}
		}
	}

	/**
	 * Get all of the populated controls
	 */
	getAllControls(): ReadonlyMap<string, SomeControl<any>> {
		return this.#controls // TODO - readonly?
	}

	/**
	 * Get all of the trigger controls
	 */
	getAllTriggers(): ControlTrigger[] {
		const triggers: ControlTrigger[] = []
		for (const control of this.#controls.values()) {
			if (control instanceof ControlTrigger) {
				triggers.push(control)
			}
		}
		return triggers
	}

	/**
	 * Get a control if it has been populated
	 */
	getControl(controlId: string): SomeControl<any> | undefined {
		if (!controlId) return undefined
		return this.#controls.get(controlId)
	}

	/**
	 * Get a Trigger control if it exists
	 */
	getTrigger(triggerId: string): ControlTrigger | undefined {
		const controlId = CreateTriggerControlId(triggerId)
		const control = this.#controls.get(controlId)
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
		const oldControlId = this.#registry.page.getControlIdAt(location)
		if (oldControlId) {
			this.deleteControl(oldControlId)
		}

		const newControlId = forceControlId || CreateBankControlId(nanoid())
		const newControl = this.createClassForControl(newControlId, 'button', definition, true)
		if (newControl) {
			this.#controls.set(newControlId, newControl)

			this.#registry.page.setControlIdAt(location, newControlId)

			newControl.triggerRedraw()

			// Ensure it is stored to the db
			newControl.commitChange()

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

		if (this.#controls.has(controlId)) throw new Error(`Trigger ${controlId} already exists`)

		const newControl = this.createClassForControl(controlId, 'trigger', definition, true)
		if (newControl) {
			this.#controls.set(controlId, newControl)

			// Ensure it is stored to the db
			newControl.commitChange()

			return true
		}

		return false
	}

	/**
	 * Initialise the controls
	 */
	init(): void {
		// Init all the control classes
		const config = this.#dbTable.all()
		for (const [controlId, controlObj] of Object.entries(config)) {
			if (controlObj && controlObj.type) {
				const inst = this.createClassForControl(controlId, 'all', controlObj, false)
				if (inst) this.#controls.set(controlId, inst)
			}
		}

		// Ensure all trigger collections are valid
		this.#cleanUnknownTriggerCollectionIds(this.#triggerCollections.collectAllCollectionIds())
	}

	/**
	 * Propagate variable changes to the controls
	 */
	onVariablesChanged(allChangedVariablesSet: Set<string>): void {
		// Inform triggers of the change
		this.triggers.emit('variables_changed', allChangedVariablesSet)

		if (allChangedVariablesSet.size > 0) {
			for (const control of this.#controls.values()) {
				if (control.supportsStyle) {
					control.onVariablesChanged(allChangedVariablesSet)
				}
			}
		}
	}

	/**
	 * Execute a press of a control
	 * @param controlId Id of the control
	 * @param pressed Whether the control is pressed
	 * @param surfaceId The surface that initiated this press
	 * @param force Trigger actions even if already in the state
	 */
	pressControl(controlId: string, pressed: boolean, surfaceId: string | undefined, force?: boolean): boolean {
		const control = this.getControl(controlId)
		if (control) {
			this.triggers.emit('control_press', controlId, pressed, surfaceId)

			control.pressControl(pressed, surfaceId, force)

			return true
		}

		return false
	}

	/**
	 * Execute rotation of a control
	 * @param controlId Id of the control
	 * @param direction Whether the control is rotated to the right
	 * @param surfaceId The surface that initiated this rotate
	 */
	rotateControl(controlId: string, direction: boolean, surfaceId: string | undefined): boolean {
		const control = this.getControl(controlId)
		if (control && control.supportsActionSets) {
			control.rotateControl(direction, surfaceId)
			return true
		}

		return false
	}

	/**
	 * Rename a connection for variables used in the controls
	 * @param labelFrom - the old connection short name
	 * @param labelTo - the new connection short name
	 */
	renameVariables(labelFrom: string, labelTo: string): void {
		for (const control of this.#controls.values()) {
			control.renameVariables(labelFrom, labelTo)
		}
	}

	/**
	 * Delete a control
	 */
	deleteControl(controlId: string): void {
		const control = this.getControl(controlId)
		if (control) {
			control.destroy()
			this.#controls.delete(controlId)

			this.#dbTable.delete(controlId)
		}

		const location = this.#registry.page.getLocationOfControlId(controlId)
		if (location) {
			this.#registry.page.setControlIdAt(location, null)

			// Notify interested parties
			this.#controlEvents.emit('updateButtonState', location, false, undefined)

			// Force a redraw
			this.#registry.graphics.invalidateButton(location)
		}
	}

	discardTriggerCollections(): void {
		this.#triggerCollections.discardAllCollections()
	}

	exportTriggerCollections(): TriggerCollection[] {
		return this.#triggerCollections.collectionData
	}

	replaceTriggerCollections(collections: TriggerCollection[]): void {
		this.#triggerCollections.replaceCollections(collections)
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
		if (!this.#registry.page.isPageValid(location.pageNumber)) return null

		const controlId = CreateBankControlId(nanoid())
		const newControl = this.createClassForControl(controlId, 'button', newType, false)
		if (!newControl) return null

		this.#controls.set(controlId, newControl)
		this.#registry.page.setControlIdAt(location, controlId)

		// Notify interested parties
		this.#controlEvents.emit('updateButtonState', location, false, undefined)

		// Force a redraw
		this.#registry.graphics.invalidateButton(location)

		return controlId
	}

	setTriggerCollectionEnabled(collectionId: string, enabled: boolean | 'toggle'): void {
		this.#triggerCollections.setCollectionEnabled(collectionId, enabled)
	}
	isTriggerCollectionEnabled(collectionId: string, onlyDirect: boolean): boolean {
		return this.#triggerCollections.isCollectionEnabled(collectionId, onlyDirect)
	}

	/**
	 * Update values for some feedbacks
	 * @param connectionId
	 * @param result - object containing new values for the feedbacks that have changed
	 */
	updateFeedbackValues(connectionId: string, result: NewFeedbackValue[]): void {
		if (result.length === 0) return

		const values: Record<string, Record<string, any>> = {}

		for (const item of result) {
			if (!values[item.controlId]) values[item.controlId] = {}

			values[item.controlId][item.id] = item.value
		}

		// Pass values to controls
		for (const [controlId, newValues] of Object.entries(values)) {
			const control = this.getControl(controlId)
			if (control && control.supportsEntities) {
				control.entities.updateFeedbackValues(connectionId, newValues)
			}
		}
	}

	/**
	 * Prune any items on controls which belong to an unknown connectionId
	 * @access public
	 */
	verifyConnectionIds(): void {
		const knownConnectionIds = new Set(this.#registry.instance.getAllInstanceIds())
		knownConnectionIds.add('internal')

		for (const control of this.#controls.values()) {
			if (!control.supportsEntities) continue
			control.entities.verifyConnectionIds(knownConnectionIds)
		}
	}
}

export interface NewFeedbackValue {
	id: string
	controlId: string
	value: any
}
