import { ControlBase } from '../ControlBase.js'
import { TriggersListRoom } from '../Controller.js'
import { cloneDeep } from 'lodash-es'
import jsonPatch from 'fast-json-patch'
import debounceFn from 'debounce-fn'
import type {
	ControlWithoutActions,
	ControlWithoutEvents,
	ControlWithOptions,
	ControlWithoutActionSets,
	ControlWithoutLayeredStyle,
	ControlWithoutPushed,
	ControlWithoutStyle,
} from '../IControlFragments.js'
import { VisitorReferencesUpdater } from '../../Resources/Visitors/ReferencesUpdater.js'
import { VisitorReferencesCollector } from '../../Resources/Visitors/ReferencesCollector.js'
import type { ControlDependencies } from '../ControlDependencies.js'
import { EntityModelType } from '@companion-app/shared/Model/EntityModel.js'
import { DrawStyleModel } from '@companion-app/shared/Model/StyleModel.js'
import type { CustomVariablesControlModel } from '@companion-app/shared/Model/CustomVariableModel.js'
import { ControlEntityListPoolCustomVariables } from '../Entities/EntityListPoolCustomVariables.js'

/**
 * Class for holding the custom variables.
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
export class ControlCustomVariables
	extends ControlBase<CustomVariablesControlModel>
	implements
		ControlWithoutActions,
		ControlWithoutEvents,
		ControlWithoutStyle,
		ControlWithoutLayeredStyle,
		ControlWithoutActionSets,
		ControlWithOptions,
		ControlWithoutPushed
{
	readonly type = 'custom_variables'

	readonly supportsActions = false
	readonly supportsEvents = false
	readonly supportsEntities = true
	readonly supportsStyle = false
	readonly supportsLayeredStyle = false
	readonly supportsActionSets = false
	readonly supportsOptions = true
	readonly supportsPushed = false

	/**
	 * The defaults options for the 'control'
	 */
	static DefaultOptions: Record<string, never> = {}

	/**
	 * Basic configuration
	 */
	options: Record<string, never>

	readonly #entities: ControlEntityListPoolCustomVariables

	/**
	 * @param registry - the application core
	 * @param eventBus - the main trigger event bus
	 * @param controlId - id of the control
	 * @param storage - persisted storage object
	 * @param isImport - if this is importing a button, not creating at startup
	 */
	constructor(
		deps: ControlDependencies,
		controlId: string,
		storage: CustomVariablesControlModel | null,
		isImport: boolean
	) {
		super(deps, controlId, `Controls/ControlTypes/CustomVariables/${controlId}`)

		this.#entities = new ControlEntityListPoolCustomVariables({
			controlId,
			commitChange: this.commitChange.bind(this),
			invalidateControl: this.triggerRedraw.bind(this),
			localVariablesChanged: null,
			instanceDefinitions: deps.instance.definitions,
			internalModule: deps.internalModule,
			moduleHost: deps.instance.moduleHost,
		})

		this.options = cloneDeep(ControlCustomVariables.DefaultOptions)

		if (!storage) {
			// New control

			// Save the change
			this.commitChange()

			// Notify interested
		} else {
			if (storage.type !== 'custom_variables')
				throw new Error(`Invalid type given to ControlCustomVariables: "${storage.type}"`)

			this.#entities.loadStorage(storage, true, isImport)

			if (isImport) this.postProcessImport()
		}

		// Ensure trigger is stored before setup
		setImmediate(() => {
			// this.#setupEvents()
		})
	}

	checkCollectionIdIsValid(validCollectionIds: Set<string>): boolean {
		// if (this.options.collectionId && !validCollectionIds.has(this.options.collectionId)) {
		// 	// collectionId is not valid, remove it
		// 	this.options.collectionId = undefined
		// 	// The parent collection is now enabled
		// 	this.setCollectionEnabled(true)
		// 	this.commitChange(false)
		// 	return true
		// }
		// return false
	}

	/**
	 * Remove any tracked state for a connection
	 */
	clearConnectionState(connectionId: string): void {
		this.#entities.clearConnectionState(connectionId)
	}

	/**
	 * Collect the instance ids and labels referenced by this control
	 * @param foundConnectionIds - instance ids being referenced
	 * @param foundConnectionLabels - instance labels being referenced
	 */
	collectReferencedConnections(foundConnectionIds: Set<string>, foundConnectionLabels: Set<string>): void {
		const allEntities = this.#entities.getAllEntities()

		for (const entities of allEntities) {
			foundConnectionIds.add(entities.connectionId)
		}

		new VisitorReferencesCollector(this.deps.internalModule, foundConnectionIds, foundConnectionLabels).visitEntities(
			allEntities,
			[]
		)
	}

	/**
	 * Inform the control that it has been moved, and anything relying on its location must be invalidated
	 */
	triggerLocationHasChanged(): void {
		this.#entities.resubscribeEntities(EntityModelType.Feedback, 'internal')
	}

	/**
	 * Convert this control to JSON
	 * To be sent to the client and written to the db
	 * @param clone - Whether to return a cloned object
	 */
	toJSON(clone = true): CustomVariablesControlModel {
		const obj: CustomVariablesControlModel = {
			type: this.type,
			options: this.options,
			variables: this.#entities.getLocalVariableEntities().map((e) => e.asEntityModel(true)),
		}
		return clone ? cloneDeep(obj) : obj
	}

	/**
	 * Remove any actions and feedbacks referencing a specified connectionId
	 */
	forgetConnection(connectionId: string): void {
		const changed = this.#entities.forgetConnection(connectionId)

		if (changed) {
			this.commitChange(true)
		}
	}

	/**
	 * Rename an instance for variables used in this control
	 * @param labelFrom - the old instance short name
	 * @param labelTo - the new instance short name
	 * @access public
	 */
	renameVariables(labelFrom: string, labelTo: string): void {
		const allEntities = this.#entities.getAllEntities()

		// Fix up references
		const changed = new VisitorReferencesUpdater(this.deps.internalModule, { [labelFrom]: labelTo }, undefined)
			.visitEntities(allEntities, [])
			.recheckChangedFeedbacks()
			.hasChanges()

		// 'redraw' if needed and save changes
		this.commitChange(changed)
	}

	/**
	 * Update an option field of this control
	 */
	// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
	optionsSetField(key: string, value: any, forceSet?: boolean): boolean {
		if (!forceSet && (key === 'sortOrder' || key === 'collectionId'))
			throw new Error('sortOrder cannot be set by the client')

		// @ts-expect-error mistmatch in types
		this.options[key] = value

		if (key === 'enabled') {
			// Pretend the collection changed, to re-trigger the events
			this.setCollectionEnabled(this.#collectionEnabled)
		}

		this.commitChange()

		return true
	}

	/**
	 * If this control was imported to a running system, do some data cleanup/validation
	 */
	postProcessImport(): void {
		this.#entities.resubscribeEntities()

		this.commitChange()
		this.sendRuntimePropsChange()
	}

	/**
	 * Emit a change to the runtime properties of this control.
	 * This is for any properties that the ui may want about this control which are not persisted in toJSON()
	 * This is done via this.toRuntimeJSON()
	 */
	#sendTriggerJsonChange(): void {
		const newJson = cloneDeep(this.toTriggerJSON())

		if (this.deps.io.countRoomMembers(TriggersListRoom) > 0) {
			if (this.#lastSentTriggerJson) {
				const patch = jsonPatch.compare(this.#lastSentTriggerJson || {}, newJson || {})
				if (patch.length > 0) {
					this.deps.io.emitToRoom(TriggersListRoom, `triggers:update`, {
						type: 'update',
						controlId: this.controlId,
						patch,
					})
				}
			} else {
				this.deps.io.emitToRoom(TriggersListRoom, `triggers:update`, {
					type: 'add',
					controlId: this.controlId,
					info: newJson,
				})
			}
		}

		this.#lastSentTriggerJson = newJson
	}

	commitChange(redraw = true): void {
		super.commitChange(redraw)

		this.#sendTriggerJsonChange()
	}

	destroy(): void {
		// This should only happen at shutdown, so we don't need to notify the ui

		this.#entities.destroy()

		super.destroy()
	}

	/**
	 * Trigger a recheck of the condition, as something has changed and it might be the 'condition'
	 * @access protected
	 */
	triggerRedraw = debounceFn(
		() => {
			try {
				// const newStatus = this.entities.checkConditionValue()
				// const runOnTrue = this.events.some((event) => event.enabled && event.type === 'condition_true')
				// const runOnFalse = this.events.some((event) => event.enabled && event.type === 'condition_false')
				// if (
				// 	this.options.enabled &&
				// 	this.#conditionCheckEvents.size > 0 &&
				// 	((runOnTrue && newStatus && !this.#conditionCheckLastValue) ||
				// 		(runOnFalse && !newStatus && this.#conditionCheckLastValue))
				// ) {
				// 	setImmediate(() => {
				// 		this.executeActions(Date.now(), TriggerExecutionSource.ConditionChange)
				// 	})
				// }
				// this.#conditionCheckLastValue = newStatus
			} catch (e) {
				this.logger.warn(`Failed to recheck condition: ${e}`)
			}
		},
		{
			before: false,
			after: true,
			wait: 10,
			maxWait: 20,
		}
	)

	getLastDrawStyle(): DrawStyleModel | null {
		return null
	}

	/**
	 * Execute a press of this control
	 */
	pressControl(_pressed: boolean, _surfaceId: string | undefined): void {
		// Nothing to do
	}
	getBitmapFeedbackSize(): { width: number; height: number } | null {
		return null
	}
}
