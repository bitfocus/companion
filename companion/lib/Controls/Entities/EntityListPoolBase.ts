import debounceFn from 'debounce-fn'
import type { JsonValue } from 'type-fest'
import {
	EntityModelType,
	type FeedbackEntityStyleOverride,
	type SomeReplaceableEntityModel,
	type SomeSocketEntityLocation,
} from '@companion-app/shared/Model/EntityModel.js'
import type { ExpressionOrValue } from '@companion-app/shared/Model/Options.js'
import { stringifyVariableValue, type VariableValues } from '@companion-app/shared/Model/Variables.js'
import type { InstanceProcessManager } from '../../Instance/ProcessManager.js'
import type { InternalController } from '../../Internal/Controller.js'
import LogController, { type Logger } from '../../Log/Controller.js'
import type { IPageStore } from '../../Page/Store.js'
import { GetLegacyStyleProperty, ParseLegacyStyle } from '../../Resources/ConvertLegacyStyleToElements.js'
import type { VariablesValues } from '../../Variables/Values.js'
import type { VariablesAndExpressionParser } from '../../Variables/VariablesAndExpressionParser.js'
import type { ControlEntityInstance } from './EntityInstance.js'
import { ControlEntityList, type ControlEntityListDefinition } from './EntityList.js'
import { EntityPoolSpecialExpressionManager } from './EntitySpecialExpressionManager.js'
import type { NewSpecialExpressionValue } from './SpecialExpressions.js'
import type { InstanceDefinitionsForEntity, NewFeedbackValue } from './Types.js'

export interface ControlEntityListChangeProps {
	/** If true, do not save changes to the database/disk */
	noSave?: boolean
	/** If true, the control should be redrawn */
	redraw: boolean
	/** The id of drawing elements that are affected */
	changedElementIds?: ReadonlySet<string>
	/** If true, invalidate all drawing elements */
	invalidateAllElements?: boolean
}
export interface ControlEntityListPoolProps {
	instanceDefinitions: InstanceDefinitionsForEntity
	internalModule: InternalController
	processManager: InstanceProcessManager
	variableValues: VariablesValues
	pageStore: IPageStore
	controlId: string
	reportChange: (options: ControlEntityListChangeProps) => void
}

/**
 * The read-only entity pool. It owns the entity lists and all runtime/read behaviour (loading, feedback
 * evaluation, variable propagation, serialization). It deliberately has NO user-facing structural edit
 * mutators (entityAdd/Remove/etc) - those are added by the entity-editing mixin (see
 * {@link ../EntityListPoolEditingMixin.js WithEntityEditing}) and so exist only on editable pools. A
 * read-only control (e.g. a preset reference) is therefore read-only by construction, with no runtime flag
 * to check and no guard to forget.
 *
 * `entityReplace` is intentionally here (not in the mixin): it is an upgrade/runtime path used when a
 * connection upgrades its entities, and must work on every control regardless of editability.
 */
export abstract class ControlEntityListPoolBase {
	/**
	 * Discriminant for the read-only vs editable pool union. `false` on the read-only base (this class and the
	 * read-only concrete pools); the editing mixin ({@link ../EntityListPoolEditingMixin.js WithEntityEditing})
	 * sets it `true`. Code narrows on this (`if (pool.isEditable)`) to reach the structural edit mutators -
	 * there is no per-control capability flag, the editability lives on the pool itself.
	 */
	abstract readonly isEditable: boolean

	/**
	 * The logger
	 */
	protected readonly logger: Logger

	readonly #instanceDefinitions: InstanceDefinitionsForEntity
	readonly #internalModule: InternalController
	readonly #processManager: InstanceProcessManager
	readonly #variableValues: VariablesValues
	readonly #isLayeredDrawing: boolean
	readonly #specialExpressionManager: EntityPoolSpecialExpressionManager
	readonly #pageStore: IPageStore

	protected readonly controlId: string

	/**
	 * Report changes to the database and disk
	 */
	protected readonly reportChange: (options: ControlEntityListChangeProps) => void

	// Public (not protected) so the editing mixins can extend this base via a generic constructor constraint.
	// The class is abstract, so it still cannot be instantiated directly.
	constructor(props: ControlEntityListPoolProps, isLayeredDrawing: boolean) {
		this.logger = LogController.createLogger(`Controls/Fragments/EntityPool/${props.controlId}`)

		this.controlId = props.controlId
		this.reportChange = props.reportChange

		this.#instanceDefinitions = props.instanceDefinitions
		this.#internalModule = props.internalModule
		this.#processManager = props.processManager
		this.#variableValues = props.variableValues
		this.#isLayeredDrawing = isLayeredDrawing
		this.#pageStore = props.pageStore

		this.#specialExpressionManager = new EntityPoolSpecialExpressionManager(
			props.controlId,
			this.createVariablesAndExpressionParser.bind(this),
			{
				isInverted: this.updateIsInvertedValues.bind(this),
				storeResult: this.updateStoreResultValues.bind(this),
			}
		)
	}

	protected createEntityList(listDefinition: ControlEntityListDefinition): ControlEntityList {
		return new ControlEntityList(
			this.#instanceDefinitions,
			this.#internalModule,
			this.#processManager,
			this.#specialExpressionManager,
			this.controlId,
			null,
			listDefinition
		)
	}

	protected tryTriggerLocalVariablesChanged(...entitiesOrNames: (ControlEntityInstance | string | null)[]): void {
		if (entitiesOrNames.length === 0) return

		const changedVariableNames = new Set<string>()
		for (const entityOrName of entitiesOrNames) {
			if (!entityOrName) continue

			const variableName = typeof entityOrName === 'string' ? entityOrName : entityOrName.localVariableName
			if (variableName) changedVariableNames.add(variableName)
		}

		if (changedVariableNames.size === 0) return

		for (const name of changedVariableNames) {
			this.#pendingChangedVariables.add(name)
		}

		/*
		 * The debounce ensures that rapid bursts of local variable updates (including circular
		 * computed-variable chains) are rate-limited before notifying the rest of the app.
		 *
		 * Additionally, we synchronously call internalModule.onVariablesChanged for this control
		 * so that condition feedbacks inside logic_while / logic_if have their cached values
		 * updated immediately, without needing a wait action.
		 *
		 * A re-entrance guard on the sync call prevents recursion: if a computed local variable's
		 * cached value changes as a side effect of the sync update (detected by updateFeedbackValues
		 * calling tryTriggerLocalVariablesChanged again), that nested call still queues to the
		 * debounce but does not re-enter the sync path.
		 */
		this.#debouncedLocalVariablesChanged()

		if (!this.#isSyncUpdatingInternalFeedbacks) {
			this.#isSyncUpdatingInternalFeedbacks = true
			try {
				this.#internalModule.onVariablesChanged(changedVariableNames, this.controlId)
			} finally {
				this.#isSyncUpdatingInternalFeedbacks = false
			}
		}
	}

	#pendingChangedVariables = new Set<string>()
	#isSyncUpdatingInternalFeedbacks = false
	#debouncedLocalVariablesChanged = debounceFn(
		() => {
			const allChangedVariables = this.#pendingChangedVariables
			this.#pendingChangedVariables = new Set()

			this.#variableValues.emit('local_variables_changed', allChangedVariables, this.controlId)
		},
		{
			wait: 5,
			maxWait: 10,
		}
	)

	/**
	 * Remove any tracked state for a connection
	 */
	clearConnectionState(connectionId: string): void {
		let changed = false
		for (const list of this.getAllEntityLists()) {
			if (list.clearCachedValueForConnectionId(connectionId)) changed = true
		}
		if (changed)
			this.reportChange({
				redraw: true,
				noSave: true,
			})
	}

	createVariablesAndExpressionParser(overrideVariableValues: VariableValues | null): VariablesAndExpressionParser {
		const controlLocation = this.#pageStore.getLocationOfControlId(this.controlId)
		const variableEntities = this.getLocalVariableEntities()

		return this.#variableValues.createVariablesAndExpressionParser(
			controlLocation,
			variableEntities,
			overrideVariableValues
		)
	}

	/**
	 * Prepare this control for deletion
	 * @access public
	 */
	destroy(): void {
		this.#specialExpressionManager.destroy()

		for (const list of this.getAllEntityLists()) {
			list.cleanup()
		}
	}

	protected abstract getEntityList(listId: SomeSocketEntityLocation): ControlEntityList | undefined
	protected abstract getAllEntityLists(): ControlEntityList[]

	abstract getLocalVariableEntities(): ControlEntityInstance[]

	/**
	 * Get all the style overrides for the layered drawing elements
	 * @returns A map of elementId -> elementProperty -> override value
	 */
	abstract getFeedbackStyleOverrides(): ReadonlyMap<
		string,
		ReadonlyMap<string, ExpressionOrValue<JsonValue | undefined>>
	>

	getLocalVariableValues(): VariableValues {
		const entities = this.getLocalVariableEntities()

		const values: VariableValues = {}

		for (const entity of entities) {
			const variableName = entity.localVariableName
			if (variableName) {
				// Strip off the prefix, as the ui doesn't expect that
				values[variableName.slice('local:'.length)] = entity.getResolvedFeedbackValue()
			}
		}

		return values
	}

	/**
	 * Find an entity by its id
	 * This will search all entity lists and through all child
	 * @param id the id of the entity to find
	 * @returns The entity instance if found, or undefined
	 */
	findEntityById(id: string): ControlEntityInstance | undefined {
		for (const list of this.getAllEntityLists()) {
			const entity = list.findById(id)
			if (entity) return entity
		}
		return undefined
	}

	/**
	 * Recursively get all the entities
	 */
	getAllEntities(): ControlEntityInstance[] {
		return this.getAllEntityLists().flatMap((entityList) => entityList.getAllEntities())
	}

	/**
	 *
	 * @param listId
	 * @returns
	 */
	getAllEntitiesInList(listId: SomeSocketEntityLocation, recursive = false): ControlEntityInstance[] {
		const list = this.getEntityList(listId)
		if (!list) return []

		if (recursive) return list.getAllEntities()
		return list.getDirectEntities()
	}

	/**
	 * Re-trigger 'subscribe' for all entities
	 * This should be used when something has changed which will require all entities to be re-run
	 * @param onlyType If set, only re-subscribe entities of this type
	 * @param onlyConnectionId If set, only re-subscribe entities for this connection
	 */
	resubscribeEntities(onlyType?: EntityModelType, onlyConnectionId?: string): void {
		for (const list of this.getAllEntityLists()) {
			list.subscribe(true, onlyType, onlyConnectionId)
		}
	}

	/**
	 * Replace an entity's stored props with a module-upgraded version.
	 *
	 * This is SOLELY the connection/module upgrade path (see {@link ../../Instance/Connection/EntityManager.js}
	 * and the legacy child handler) - it is invoked when a connection upgrades the definition of one of its
	 * entities, never as a result of a user edit. That is why it lives on the read-only base (it must work on
	 * every control, including read-only ones like a preset reference) and is not part of the editable mutator
	 * surface. Do not call it for user-facing edits.
	 */
	entityReplaceForUpgrade(
		newProps: SomeReplaceableEntityModel,
		skipNotifyModule = false
	): ControlEntityInstance | undefined {
		for (const entityList of this.getAllEntityLists()) {
			const entity = entityList.findById(newProps.id)
			if (!entity) continue

			// Ignore if the types do not match
			if (entity.type !== newProps.type) return undefined

			const oldElementIds = entity.styleOverrideAffectedElementIds

			// If this is a layered drawing, translate the style into the overrides format
			const existingStyleOverrides = entity.styleOverrides
			if (
				this.#isLayeredDrawing &&
				newProps.type === EntityModelType.Feedback &&
				newProps.style &&
				existingStyleOverrides
			) {
				const newOverrides: FeedbackEntityStyleOverride[] = []

				const parsedStyle = ParseLegacyStyle(newProps.style)

				// Translate the old advanced feedback property lookup into the newly produced value
				for (const override of existingStyleOverrides) {
					if (override.override.isExpression) {
						// Preserve any expression values, we don't want to replace the users hard work by accident
						newOverrides.push(override)
					} else {
						const newValue = GetLegacyStyleProperty(
							parsedStyle,
							newProps.style,
							stringifyVariableValue(override.override.value) ?? '',
							override.elementProperty
						)

						// Only preserve ones which exist in the new style, otherwise they should be discarded as they wont have a real value to use
						if (newValue) {
							newOverrides.push({
								...override,
								override: newValue,
							})
						}
					}
				}

				newProps = { ...newProps, styleOverrides: newOverrides, style: undefined }
			}

			entity.replaceProps(newProps, skipNotifyModule)

			this.tryTriggerLocalVariablesChanged(entity)

			this.reportChange({
				redraw: true,
				changedElementIds: entity.styleOverrideAffectedElementIds?.union(oldElementIds || new Set<string>()),
			})

			return entity
		}

		return undefined
	}

	/**
	 * Remove any entities referencing a specified connectionId
	 */
	forgetConnection(connectionId: string): void {
		let changed = false
		for (const list of this.getAllEntityLists()) {
			if (list.forgetForConnection(connectionId)) changed = true
		}

		if (changed) {
			this.reportChange({
				redraw: true,
				invalidateAllElements: true,
			})
		}
	}

	/**
	 * Prune all entities referencing unknown connections
	 * Doesn't do any cleanup, as it is assumed that the connection has not been running
	 */
	verifyConnectionIds(knownConnectionIds: ReadonlySet<string>): void {
		let changed = false

		for (const list of this.getAllEntityLists()) {
			if (list.verifyConnectionIds(knownConnectionIds)) changed = true
		}

		if (changed) {
			this.reportChange({
				redraw: true,
				invalidateAllElements: true,
			})
		}
	}

	/**
	 * Update the feedbacks on the control with new values
	 * @param connectionId The instance the feedbacks are for
	 * @param newValues The new feedback values
	 */
	abstract updateFeedbackValues(connectionId: string, newValues: ReadonlyMap<string, NewFeedbackValue>): void

	/**
	 * Update the isInverted values on the control with new calculated isInverted values
	 * @param newValues The new isInverted values
	 */
	protected abstract updateIsInvertedValues(
		newValues: ReadonlyMap<string, NewSpecialExpressionValue<'isInverted'>>
	): void

	/**
	 * Update the storeResult values on the control with new calculated
	 * storeResult values
	 * @param newValues The new storeResult values
	 */
	protected abstract updateStoreResultValues(
		newValues: ReadonlyMap<string, NewSpecialExpressionValue<'storeResult'>>
	): void

	/**
	 * Get all the connectionIds for entities which are active
	 */
	getAllEnabledConnectionIds(): Set<string> {
		const connectionIds = new Set<string>()

		for (const list of this.getAllEntityLists()) {
			list.getAllEnabledConnectionIds(connectionIds)
		}

		return connectionIds
	}

	/**
	 * Propagate variable changes
	 * @param changedVariables - variables with changes
	 */
	onVariablesChanged(changedVariables: ReadonlySet<string>): void {
		this.#specialExpressionManager.onVariablesChanged(changedVariables)
	}
}
