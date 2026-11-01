import type { SomeControlId } from '@companion-app/shared/ControlId.js'
import LogController from '../Log/Controller.js'

/**
 * Receives the variable changes that may affect some of its dependencies.
 *
 * A notification means "possibly affected": a listener should still check the change against what it last
 * read. Being told about a change it doesn't care about is harmless; missing one is a bug. The registry relies
 * on that to keep maintenance cheap (eg a dependency that is waiting to be re-evaluated keeps its old variables).
 */
export interface VariableDependencyListener<T> {
	/**
	 * Some of this listener's dependencies reference a changed variable (or are armed).
	 * Called at most once per change, with every affected dependency of this listener.
	 */
	onVariableDependenciesChanged(hits: ReadonlyArray<VariableDependency<T>>, changed: ReadonlySet<string>): void
}

/** Variables whose names are relative to the control they are evaluated for */
function isControlRelative(variableId: string): boolean {
	return variableId.startsWith('local:') || variableId.startsWith('this:') || variableId.startsWith('page:')
}

/**
 * The variables something (an entity, a drawn style, ...) read when it was last evaluated, registered so that
 * it is told when one of them changes, instead of being asked about every change.
 *
 * Create one with {@link VariableDependencyRegistry.create}, update it with {@link set} after every evaluation,
 * and {@link dispose} it when its owner goes away. Every dependency belongs to a control, and is also disposed
 * when that control is deleted.
 */
export class VariableDependency<T> {
	readonly #index: DependencyIndex
	readonly listener: VariableDependencyListener<T>
	readonly controlId: SomeControlId
	/** Data for the listener to identify what this dependency is for */
	readonly data: T

	#variableIds: ReadonlySet<string> | null = null
	#disposed = false

	/** Stamp of the last dispatch that collected this dependency, to collect it only once */
	epoch = 0

	constructor(index: DependencyIndex, listener: VariableDependencyListener<T>, controlId: SomeControlId, data: T) {
		this.#index = index
		this.listener = listener
		this.controlId = controlId
		this.data = data
	}

	/** The variables last registered, or null when none */
	get variableIds(): ReadonlySet<string> | null {
		return this.#variableIds
	}

	get isDisposed(): boolean {
		return this.#disposed
	}

	/**
	 * Replace the variables this depends on, typically with those read by an evaluation that just completed.
	 * The set is kept rather than copied, so it must not be mutated afterwards.
	 * This also ends any {@link arm}. A no-op once disposed.
	 */
	set(variableIds: ReadonlySet<string> | null): void {
		if (this.#disposed) return

		this.#index.disarm(this)

		const newIds = variableIds && variableIds.size > 0 ? variableIds : null
		const oldIds = this.#variableIds
		this.#variableIds = newIds

		if (oldIds === newIds) return

		// Re-evaluating rarely changes what was read, so check for that before touching the index
		if (oldIds && newIds && oldIds.size === newIds.size) {
			let same = true
			for (const id of newIds) {
				if (!oldIds.has(id)) {
					same = false
					break
				}
			}
			if (same) return
		}

		if (oldIds) {
			for (const id of oldIds) {
				if (!newIds || !newIds.has(id)) this.#index.remove(this, id)
			}
		}
		if (newIds) {
			for (const id of newIds) {
				if (!oldIds || !oldIds.has(id)) this.#index.add(this, id)
			}
		}
	}

	/**
	 * Be notified of every change (for this control) until the next {@link set} or {@link disarm}.
	 *
	 * For an asynchronous evaluation: what it reads isn't known until it completes, so a change landing mid-way
	 * to a variable it is about to read would otherwise be missed.
	 */
	arm(): void {
		if (this.#disposed) return
		this.#index.arm(this)
	}

	/** End an {@link arm} without changing the variables, eg when the evaluation failed */
	disarm(): void {
		this.#index.disarm(this)
	}

	/** Stop tracking this dependency. Safe to call more than once */
	dispose(): void {
		if (this.#disposed) return
		this.#disposed = true

		if (this.#variableIds) {
			for (const id of this.#variableIds) this.#index.remove(this, id)
			this.#variableIds = null
		}
		this.#index.disarm(this)
		this.#index.forget(this)
	}
}

/** The indexes shared between the registry and its dependencies */
class DependencyIndex {
	/** variableId, or `${controlId}\n${variableId}` for control-relative variables -> dependencies */
	readonly byKey = new Map<string, Set<VariableDependency<any>>>()
	/** Every live dependency, by controlId */
	readonly byControl = new Map<SomeControlId, Set<VariableDependency<any>>>()
	/** Dependencies that want every change, until they are next set */
	readonly armed = new Set<VariableDependency<any>>()

	static key(controlId: SomeControlId, variableId: string): string {
		return isControlRelative(variableId) ? `${controlId}\n${variableId}` : variableId
	}

	track(dependency: VariableDependency<any>): void {
		let deps = this.byControl.get(dependency.controlId)
		if (!deps) {
			deps = new Set()
			this.byControl.set(dependency.controlId, deps)
		}
		deps.add(dependency)
	}

	forget(dependency: VariableDependency<any>): void {
		const deps = this.byControl.get(dependency.controlId)
		if (!deps) return
		deps.delete(dependency)
		if (deps.size === 0) this.byControl.delete(dependency.controlId)
	}

	add(dependency: VariableDependency<any>, variableId: string): void {
		const key = DependencyIndex.key(dependency.controlId, variableId)
		let deps = this.byKey.get(key)
		if (!deps) {
			deps = new Set()
			this.byKey.set(key, deps)
		}
		deps.add(dependency)
	}

	remove(dependency: VariableDependency<any>, variableId: string): void {
		const key = DependencyIndex.key(dependency.controlId, variableId)
		const deps = this.byKey.get(key)
		if (!deps) return
		deps.delete(dependency)
		if (deps.size === 0) this.byKey.delete(key)
	}

	arm(dependency: VariableDependency<any>): void {
		this.armed.add(dependency)
	}

	disarm(dependency: VariableDependency<any>): void {
		this.armed.delete(dependency)
	}
}

/**
 * A reverse index of which variables are referenced by what, so that a variable change only reaches the
 * things that read one of the changed variables, rather than every consumer scanning everything it holds.
 *
 * Control-relative variables (`local:`, `this:`, `page:`) are indexed per control, as the same name means a
 * different variable on every control; changes to those are always scoped to the controls they apply to.
 */
export class VariableDependencyRegistry {
	readonly #logger = LogController.createLogger('Variables/DependencyRegistry')

	readonly #index = new DependencyIndex()
	#epoch = 0

	/** Create a dependency, initially referencing no variables */
	create<T>(listener: VariableDependencyListener<T>, controlId: SomeControlId, data: T): VariableDependency<T> {
		const dependency = new VariableDependency(this.#index, listener, controlId, data)
		this.#index.track(dependency)
		return dependency
	}

	/** Dispose every dependency belonging to a control, as it has been deleted */
	disposeControl(controlId: SomeControlId): void {
		const deps = this.#index.byControl.get(controlId)
		if (!deps) return

		for (const dependency of Array.from(deps)) {
			dependency.dispose()
		}
	}

	/**
	 * Notify the listeners of every dependency affected by a change.
	 * @param changed The variables that changed
	 * @param controlIdFilter null for a global change, or the controls the change is scoped to
	 */
	dispatch(changed: ReadonlySet<string>, controlIdFilter: ReadonlySet<SomeControlId> | null): void {
		if (changed.size === 0) return

		const epoch = ++this.#epoch
		let hitsByListener: Map<VariableDependencyListener<any>, VariableDependency<any>[]> | null = null

		const collect = (dependency: VariableDependency<any>, checkFilter: boolean) => {
			if (dependency.epoch === epoch) return
			if (checkFilter && controlIdFilter && !controlIdFilter.has(dependency.controlId)) return
			dependency.epoch = epoch

			if (!hitsByListener) hitsByListener = new Map()
			const hits = hitsByListener.get(dependency.listener)
			if (hits) {
				hits.push(dependency)
			} else {
				hitsByListener.set(dependency.listener, [dependency])
			}
		}

		// Collect everything before notifying anyone, so that listeners changing dependencies can't affect this pass
		for (const variableId of changed) {
			if (isControlRelative(variableId)) {
				// Only meaningful for specific controls, so a global change can't affect any
				if (!controlIdFilter) continue

				for (const controlId of controlIdFilter) {
					const deps = this.#index.byKey.get(`${controlId}\n${variableId}`)
					if (deps) for (const dependency of deps) collect(dependency, false)
				}
			} else {
				const deps = this.#index.byKey.get(variableId)
				if (deps) for (const dependency of deps) collect(dependency, true)
			}
		}
		for (const dependency of this.#index.armed) {
			collect(dependency, true)
		}

		if (!hitsByListener) return

		for (const [listener, hits] of hitsByListener as Map<VariableDependencyListener<any>, VariableDependency<any>[]>) {
			// A previous listener may have disposed some of these
			const liveHits = hits.filter((dependency) => !dependency.isDisposed)
			if (liveHits.length === 0) continue

			try {
				listener.onVariableDependenciesChanged(liveHits, changed)
			} catch (e) {
				this.#logger.error(`Failed to process variables change: ${e}`)
			}
		}
	}

	/** Counts of what is being tracked, for tests and diagnostics */
	stats(): { keys: number; controls: number; dependencies: number; armed: number } {
		let dependencies = 0
		for (const deps of this.#index.byControl.values()) dependencies += deps.size

		return {
			keys: this.#index.byKey.size,
			controls: this.#index.byControl.size,
			dependencies,
			armed: this.#index.armed.size,
		}
	}
}
