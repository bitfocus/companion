import debounceFn from 'debounce-fn'
import isEqual from 'fast-deep-equal'
import type { SomeEntityModel } from '@companion-app/shared/Model/EntityModel.js'
import LogController, { type Logger } from '../../Log/Controller.js'
import { MAX_CUSTOM_ACTION_DEPTH } from '../CustomActionRunFrame.js'
import type { ControlEntityInstance } from '../Entities/EntityInstance.js'
import type { EntityScope } from '../Entities/Types.js'
import type { IControlStore } from '../IControlStore.js'
import type { RenderClock } from '../RenderClock.js'
import type { CustomEntityScope } from './CustomEntityScope.js'
import type { CustomEntitySource, CustomEntityValues } from './Types.js'

/**
 * The copy of a custom action or feedback held by an entity which calls it
 */
export interface PlacedCopy {
	/** The control holding the calling entity */
	readonly controlId: string
	/** The scope the calling entity parses its options in */
	callerScope: EntityScope
	/** The control id of the custom entity which was copied, if there is a copy */
	sourceControlId: string | null
	/** The scope of the copy, or null if there is no copy */
	scope: CustomEntityScope | null
	/** The variables the inputs of the copy referenced when they were parsed */
	referencedVariableIds: ReadonlySet<string>
}

/**
 * Every entity which calls a custom action or feedback holds a copy of its entities and local variables.
 * The copy is subscribed with the inputs given by the calling entity, so that the entities can depend on the inputs.
 *
 * The copies are never persisted, and are rebuilt whenever the custom entity changes.
 */
export abstract class CustomEntityCopyManager<TSource extends CustomEntitySource> {
	protected readonly logger: Logger

	protected readonly controlStore: Pick<IControlStore, 'getControl' | 'updateFeedbackValues'>
	protected readonly renderClock: RenderClock

	/** The copies, by the entity which calls the custom entity */
	readonly #copies = new Map<ControlEntityInstance, PlacedCopy>()

	/** The custom entities which have changed, so their copies need rebuilding */
	#changedSourceIds = new Set<string>()

	constructor(
		loggerName: string,
		controlStore: Pick<IControlStore, 'getControl' | 'updateFeedbackValues'>,
		renderClock: RenderClock
	) {
		this.logger = LogController.createLogger(loggerName)
		this.controlStore = controlStore
		this.renderClock = renderClock
	}

	/**
	 * Get the control id of the custom entity called by an entity
	 */
	protected abstract getSourceControlId(caller: ControlEntityInstance): string

	/**
	 * Get the custom entity with a control id, if there is one of the type handled
	 */
	protected abstract getSource(controlId: string): TSource | undefined

	/**
	 * Create the scope of a copy
	 * @param caller The entity which calls the custom entity
	 * @param callerScope The scope the calling entity parses its options in
	 * @param source The custom entity being copied
	 * @param callerControlId The control which holds the copy
	 * @param chain The custom entities the copy is inside, ending with this one
	 * @param values The inputs and local variable values of the copy
	 */
	protected abstract createScope(
		caller: ControlEntityInstance,
		callerScope: EntityScope,
		source: TSource,
		callerControlId: string,
		chain: ReadonlyArray<string>,
		values: CustomEntityValues
	): CustomEntityScope

	/**
	 * Build the entities of the copy held by a calling entity, as transient child groups of it
	 */
	protected abstract buildHeldCopy(caller: ControlEntityInstance, scope: CustomEntityScope, source: TSource): void

	/**
	 * Remove the entities of the copy held by a calling entity
	 */
	protected abstract clearHeldCopy(caller: ControlEntityInstance): void

	/**
	 * An entity which calls a custom entity has been added or changed, so build or update its copy
	 * @param caller The entity which calls a custom entity
	 * @param controlId The control holding the entity
	 * @param callerScope The scope the entity parses its options in
	 */
	entityUpdate(caller: ControlEntityInstance, controlId: string, callerScope: EntityScope): void {
		if (caller.disabled) {
			// A disabled entity has nothing subscribed
			this.#removeCopy(caller)
			return
		}

		const copy = this.#copies.get(caller)
		if (copy && copy.sourceControlId === this.getSourceControlId(caller)) {
			copy.callerScope = callerScope
			this.#refreshInputs(caller, copy)
		} else {
			const newCopy: PlacedCopy = copy ?? {
				controlId,
				callerScope,
				sourceControlId: null,
				scope: null,
				referencedVariableIds: new Set(),
			}
			newCopy.callerScope = callerScope
			this.#copies.set(caller, newCopy)
			this.#build(caller, newCopy)
		}
	}

	/**
	 * An entity which calls a custom entity has been removed or disabled, so remove its copy
	 * @param caller The entity which calls a custom entity
	 */
	entityDelete(caller: ControlEntityInstance): void {
		this.#removeCopy(caller)
	}

	/**
	 * Get the scope of the copy held by an entity which calls a custom entity
	 * @param caller The entity which calls a custom entity
	 * @returns The scope, or undefined if the entity has no copy
	 */
	getCopyScope(caller: ControlEntityInstance): CustomEntityScope | undefined {
		return this.#copies.get(caller)?.scope ?? undefined
	}

	/**
	 * Get the copy held by an entity which calls a custom entity
	 */
	protected getPlacedCopy(caller: ControlEntityInstance): PlacedCopy | undefined {
		return this.#copies.get(caller)
	}

	/**
	 * A custom entity has been changed or deleted, so its copies need rebuilding
	 * @param sourceControlId The control id of the custom entity
	 */
	onCustomEntityChanged(sourceControlId: string): void {
		this.#changedSourceIds.add(sourceControlId)
		this.#debounceRebuildChanged()
	}

	readonly #debounceRebuildChanged = debounceFn(
		() => {
			const changedIds = this.#changedSourceIds
			this.#changedSourceIds = new Set()

			// Building a copy adds and removes the copies nested inside it, so work from a snapshot
			for (const [caller, copy] of [...this.#copies]) {
				if (this.#copies.get(caller) !== copy) continue

				if (changedIds.has(this.getSourceControlId(caller))) {
					this.#build(caller, copy)
				}
			}
		},
		{ wait: 20, maxWait: 100 }
	)

	/**
	 * Some variables have changed, so re-parse the inputs of any copies which used them
	 * @param changedVariables The ids of the variables which changed
	 * @param controlIdFilter If set, only the controls the change applies to
	 */
	onVariablesChanged(changedVariables: ReadonlySet<string>, controlIdFilter: ReadonlySet<string> | null): void {
		// Re-parsing the inputs of a copy can replace the copies nested inside it, so work from a snapshot
		for (const [caller, copy] of [...this.#copies]) {
			if (this.#copies.get(caller) !== copy) continue
			if (controlIdFilter && !controlIdFilter.has(copy.controlId)) continue

			copy.scope?.specialExpressionManager.onVariablesChanged(changedVariables)

			if (!changedVariables.isDisjointFrom(copy.referencedVariableIds)) {
				this.#refreshInputs(caller, copy)
			}
		}
	}

	/**
	 * Build the copy held by a calling entity, replacing any existing copy
	 */
	#build(caller: ControlEntityInstance, copy: PlacedCopy): void {
		this.#clearCopy(caller, copy)

		const sourceControlId = this.getSourceControlId(caller)
		copy.sourceControlId = sourceControlId

		const source = this.getSource(sourceControlId)
		if (!source) return

		const chain = copy.callerScope.customActionChain
		if (chain.includes(sourceControlId)) {
			this.logger.warn(`Not using "${source.options.name}" in ${copy.controlId}, as it uses itself`)
			return
		}
		if (chain.length >= MAX_CUSTOM_ACTION_DEPTH) {
			this.logger.warn(`Not using "${source.options.name}" in ${copy.controlId}, as it is nested too deeply`)
			return
		}

		const { options, referencedVariableIds } = source.parseCallInputs(
			caller.rawOptions,
			copy.callerScope.createVariablesAndExpressionParser(null),
			copy.controlId
		)
		copy.referencedVariableIds = referencedVariableIds

		const scope = this.createScope(caller, copy.callerScope, source, copy.controlId, [...chain, sourceControlId], {
			options,
			localValues: new Map(),
		})
		copy.scope = scope

		this.buildHeldCopy(caller, scope, source)
	}

	/**
	 * Re-parse the inputs of a copy, and re-subscribe its entities if they have changed
	 */
	#refreshInputs(caller: ControlEntityInstance, copy: PlacedCopy): void {
		const scope = copy.scope
		if (!scope || !copy.sourceControlId) return

		const source = this.getSource(copy.sourceControlId)
		if (!source) return

		const { options, referencedVariableIds } = source.parseCallInputs(
			caller.rawOptions,
			copy.callerScope.createVariablesAndExpressionParser(null),
			copy.controlId
		)
		copy.referencedVariableIds = referencedVariableIds

		if (isEqual(options, scope.values.options)) return

		scope.setValues({ ...scope.values, options })
	}

	/**
	 * Remove the entities and scope of a copy
	 */
	#clearCopy(caller: ControlEntityInstance, copy: PlacedCopy): void {
		this.clearHeldCopy(caller)

		copy.scope?.destroy()
		copy.scope = null
		copy.sourceControlId = null
		copy.referencedVariableIds = new Set()
	}

	#removeCopy(caller: ControlEntityInstance): void {
		const copy = this.#copies.get(caller)
		if (!copy) return

		this.#copies.delete(caller)
		this.#clearCopy(caller, copy)
	}
}

/**
 * Prefix the ids of some entities and their children, so that copies of them have their own ids
 */
export function deriveEntityIds(prefix: string, models: SomeEntityModel[]): SomeEntityModel[] {
	return models.map((model) => {
		const children = model.children
		return {
			...model,
			id: `${prefix}${model.id}`,
			...(children && {
				children: Object.fromEntries(
					Object.entries(children).map(([groupId, entities]) => [
						groupId,
						entities ? deriveEntityIds(prefix, entities) : entities,
					])
				),
			}),
		}
	})
}
