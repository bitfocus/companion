import { ControlBase } from '../ControlBase.js'
import { CustomVariablesListRoom } from '../Controller.js'
import { cloneDeep } from 'lodash-es'
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
import { EntityListPoolCustomVariable } from '../Entities/EntityListPoolCustomVariable.js'
import { EntityModelType } from '@companion-app/shared/Model/EntityModel.js'
import { DrawStyleModel } from '@companion-app/shared/Model/StyleModel.js'
import {
	ClientCustomVariableData,
	CustomVariableModel2,
	CustomVariableOptions,
} from '@companion-app/shared/Model/CustomVariableModel.js'
import jsonPatch from 'fast-json-patch'
import { CompanionVariableValue } from '@companion-module/base'
import { isInternalUserValueFeedback } from '../Entities/EntityInstance.js'

/**
 * Class for a custom variable.
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
export class ControlCustomVariable
	extends ControlBase<CustomVariableModel2>
	implements
		ControlWithoutActions,
		ControlWithoutEvents,
		ControlWithoutStyle,
		ControlWithoutLayeredStyle,
		ControlWithoutActionSets,
		ControlWithOptions,
		ControlWithoutPushed
{
	readonly type = 'custom-variable'

	readonly supportsActions = false
	readonly supportsEvents = false
	readonly supportsEntities = true
	readonly supportsStyle = false
	readonly supportsLayeredStyle = false
	readonly supportsActionSets = false
	readonly supportsOptions = true
	readonly supportsPushed = false

	/**
	 * The defaults options for a trigger
	 */
	static DefaultOptions: CustomVariableOptions = {
		variableName: '',
		description: 'A custom variable',
		sortOrder: 0,
	}

	/**
	 * The last sent custom-variable json object
	 */
	#lastSentDefinitionJson: ClientCustomVariableData | null = null

	/**
	 * Basic trigger configuration
	 */
	options: CustomVariableOptions

	readonly entities: EntityListPoolCustomVariable // TODO - should this be private?

	/**
	 * @param registry - the application core
	 * @param eventBus - the main trigger event bus
	 * @param controlId - id of the control
	 * @param storage - persisted storage object
	 * @param isImport - if this is importing a button, not creating at startup
	 */
	constructor(deps: ControlDependencies, controlId: string, storage: CustomVariableModel2 | null, isImport: boolean) {
		super(deps, controlId, `Controls/ControlTypes/CustomVariable/${controlId}`)

		this.entities = new EntityListPoolCustomVariable({
			controlId,
			commitChange: this.commitChange.bind(this),
			invalidateControl: this.triggerRedraw.bind(this),
			localVariablesChanged: null,
			instanceDefinitions: deps.instance.definitions,
			internalModule: deps.internalModule,
			moduleHost: deps.instance.moduleHost,
		})

		this.options = cloneDeep(ControlCustomVariable.DefaultOptions)

		if (!storage) {
			// New control

			// Save the change
			this.commitChange()

			// Notify interested
		} else {
			if (storage.type !== 'custom-variable')
				throw new Error(`Invalid type given to ControlCustomVariable: "${storage.type}"`)

			this.options = storage.options || this.options
			this.entities.loadStorage(storage, true, isImport)

			if (isImport) this.postProcessImport()
			else this.commitChange()
		}

		// // Ensure trigger is stored before setup
		// setImmediate(() => {
		// 	this.#setupEvents()
		// })
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
	 * Remove any tracked state for a connection
	 */
	clearConnectionState(connectionId: string): void {
		this.entities.clearConnectionState(connectionId)
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
		const allEntities = this.entities.getAllEntities()

		for (const entities of allEntities) {
			foundConnectionIds.add(entities.connectionId)
		}

		new VisitorReferencesCollector(
			this.deps.internalModule,
			foundConnectionIds,
			foundConnectionLabels,
			foundVariables
		).visitEntities(allEntities, [])
	}

	/**
	 * Inform the control that it has been moved, and anything relying on its location must be invalidated
	 */
	triggerLocationHasChanged(): void {
		this.entities.resubscribeEntities(EntityModelType.Feedback, 'internal')
	}

	/**
	 * Convert this control to JSON
	 * To be sent to the client and written to the db
	 * @param clone - Whether to return a cloned object
	 */
	toJSON(clone = true): CustomVariableModel2 {
		const obj: CustomVariableModel2 = {
			type: this.type,
			options: this.options,
			entity: this.entities.getRootEntity()?.asEntityModel(true) || null,
		}
		return clone ? cloneDeep(obj) : obj
	}

	toClientJSON(): ClientCustomVariableData {
		return {
			type: this.type,
			...this.options,
			// lastExecuted: this.#lastExecuted,
			// description: eventStrings.join('<br />'),
		}
	}

	/**
	 * Remove any actions and feedbacks referencing a specified connectionId
	 */
	forgetConnection(connectionId: string): void {
		const changed = this.entities.forgetConnection(connectionId)

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
		const allEntities = this.entities.getAllEntities()

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

		this.commitChange()

		return true
	}

	/**
	 * If this control was imported to a running system, do some data cleanup/validation
	 */
	postProcessImport(): void {
		this.entities.resubscribeEntities()

		this.commitChange()
		this.sendRuntimePropsChange()
	}

	/**
	 * Emit a change to the runtime properties of this control.
	 * This is for any properties that the ui may want about this control which are not persisted in toJSON()
	 * This is done via this.toRuntimeJSON()
	 */
	#sendTriggerJsonChange(): void {
		const newJson = cloneDeep(this.toClientJSON())
		if (this.deps.io.countRoomMembers(CustomVariablesListRoom) > 0) {
			if (this.#lastSentDefinitionJson) {
				const patch = jsonPatch.compare(this.#lastSentDefinitionJson || {}, newJson || {})
				if (patch.length > 0) {
					this.deps.io.emitToRoom(CustomVariablesListRoom, `custom-variables2:update`, {
						type: 'update',
						controlId: this.controlId,
						patch,
					})
				}
			} else {
				this.deps.io.emitToRoom(CustomVariablesListRoom, `custom-variables2:update`, {
					type: 'add',
					controlId: this.controlId,
					info: newJson,
				})
			}
		}
		this.#lastSentDefinitionJson = newJson
	}

	commitChange(redraw = true): void {
		super.commitChange(redraw)

		this.#sendTriggerJsonChange()

		this.deps.events.emit('customVariableDefinitionChanged', this.controlId, this.toClientJSON())
	}

	destroy(): void {
		this.entities.destroy()

		super.destroy()

		this.deps.events.emit('customVariableDefinitionChanged', this.controlId, null)

		if (this.deps.io.countRoomMembers(CustomVariablesListRoom) > 0) {
			this.deps.io.emitToRoom(CustomVariablesListRoom, `custom-variables2:update`, {
				type: 'remove',
				controlId: this.controlId,
			})
		}
	}

	/**
	 * Trigger a recheck of the condition, as something has changed and it might be the 'condition'
	 * @access protected
	 */
	triggerRedraw = debounceFn(
		() => {
			const name = this.options.variableName
			if (!name) return

			// TODO - check for duplicates

			this.deps.variables.values.setVariableValues('custom', [
				{ id: name, value: this.entities.getRootEntity()?.getResolvedFeedbackValue() },
			])
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

	setUserValue(value: CompanionVariableValue | undefined): void {
		const entity = this.#getUserValueEntity()
		if (!entity) {
			this.logger.info(`Variable is not a User Value and cannot be set manually`)
			return
		}

		if (entity.setUserValue(value)) {
			this.commitChange(true)
		} else {
			this.triggerRedraw()
		}
	}

	resetValueToDefault(): void {
		const entity = this.#getUserValueEntity()
		if (!entity) {
			this.logger.info(`Variable is not a User Value and cannot be set manually`)
			return
		}

		entity.setUserValue(entity.rawOptions.startup_value)

		this.commitChange(true)
	}

	syncValueToDefault(): void {
		const entity = this.#getUserValueEntity()
		if (!entity) {
			this.logger.info(`Variable is not a User Value and cannot be set manually`)
			return
		}

		entity.rawOptions.startup_value = entity.feedbackValue

		this.commitChange(true)
	}

	#getUserValueEntity() {
		const entity = this.entities.getRootEntity()
		if (!entity) return undefined

		if (isInternalUserValueFeedback(entity)) return entity
		return undefined
	}
}
