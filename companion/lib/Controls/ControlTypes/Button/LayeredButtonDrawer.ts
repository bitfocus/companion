import debounceFn from 'debounce-fn'
import type { JsonValue } from 'type-fest'
import { formatLocation } from '@companion-app/shared/ControlId.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import type { ExpressionOrValue } from '@companion-app/shared/Model/Options.js'
import type { SomeButtonGraphicsElement } from '@companion-app/shared/Model/StyleLayersModel.js'
import {
	ButtonGraphicsShowStatusIcons,
	type DrawStyleButtonStateProps,
	type DrawStyleLayeredButtonModel,
} from '@companion-app/shared/Model/StyleModel.js'
import type { VariableValues } from '@companion-app/shared/Model/Variables.js'
import {
	ConvertSomeButtonGraphicsElementForDrawing,
	type DrawnAndHidden,
} from '../../../Graphics/ConvertGraphicsElements.js'
import { ElementConversionCache } from '../../../Graphics/ElementConversionCache.js'
import type { ImageResult } from '../../../Graphics/ImageResult.js'
import type { CompositeElementIdString } from '../../../Instance/Definitions.js'
import LogController, { type Logger } from '../../../Log/Controller.js'
import type { ControlDependencies } from '../../ControlDependencies.js'
import type { ControlEntityInstance } from '../../Entities/EntityInstance.js'
import { CreateElementOfType } from './LayerDefaults.js'

/** Anything that can visit the draw elements (e.g. the reference collector/updater visitors). */
export interface DrawElementsVisitor {
	visitDrawElements(elements: SomeButtonGraphicsElement[]): void
}

/**
 * The slice of an entity pool the drawer reads when rendering (local variables + feedback style overrides).
 * `ControlEntityListPoolButton` satisfies this; controls without entities (e.g. page buttons) pass `null`.
 */
export interface LayeredButtonDrawerEntitySource {
	getLocalVariableEntities(): ControlEntityInstance[]
	getFeedbackStyleOverrides(): ReadonlyMap<string, ReadonlyMap<string, ExpressionOrValue<JsonValue | undefined>>>
}

/**
 * The small surface the drawer needs back from the owning control to render. Kept deliberately minimal.
 */
export interface LayeredButtonDrawerHost {
	getButtonStateProps(): DrawStyleButtonStateProps
	/** The control's entity pool (for local variables + feedback overrides), or null if it has none. */
	readonly entities: LayeredButtonDrawerEntitySource | null
}

const emptyFeedbackOverrides: ReadonlyMap<string, never> = new Map<string, never>()

/**
 * Tracks one kind of draw dependency - referenced variables, composite element types, or referenced button
 * locations - across a draw. Each is split into what was actually **drawn** and what was only preserved
 * **while hidden** (children of a disabled group/composite, whose cache entries survive but aren't rendered).
 *
 * A change to either kind must evict the affected cache entries; only a change to something *drawn* warrants
 * a redraw, since hidden output isn't visible until it is shown again. Bundling the drawn/hidden pair and that
 * decision here means a newly-added dependency kind gets the hidden-eviction behaviour for free, instead of
 * each call site re-deriving (and likely forgetting) it.
 */
class DrawDependency<T> {
	/** Dependencies of elements drawn last pass; a change needs a redraw. `null` when empty. */
	#drawn: ReadonlySet<T> | null = null
	/** Dependencies of preserved-but-hidden elements; a change only needs their stale cache evicted. */
	#hidden: ReadonlySet<T> | null = null

	/** Evict the cache entries affected by a change (the cache decides which entries those are). */
	readonly #evict: (changed: ReadonlySet<T>) => void

	constructor(evict: (changed: ReadonlySet<T>) => void) {
		this.#evict = evict
	}

	/** Record the drawn/hidden dependencies of a completed draw (empty sets are stored as `null`). */
	commit(references: DrawnAndHidden<T>): void {
		this.#drawn = references.drawn.size > 0 ? references.drawn : null
		this.#hidden = references.hidden.size > 0 ? references.hidden : null
	}

	/** Whether a change touches something that was actually drawn (and so warrants a redraw). */
	affectsDrawn(changed: ReadonlySet<T>): boolean {
		return !!this.#drawn && !this.#drawn.isDisjointFrom(changed)
	}

	/**
	 * Handle a change: evict the affected (drawn or hidden) cache entries and report whether a redraw is
	 * needed. Returns `false` and does nothing when the change is irrelevant to this draw.
	 */
	onChanged(changed: ReadonlySet<T>): boolean {
		const affectsDrawn = this.affectsDrawn(changed)
		const affectsHidden = !!this.#hidden && !this.#hidden.isDisjointFrom(changed)
		if (!affectsDrawn && !affectsHidden) return false

		this.#evict(changed)
		return affectsDrawn
	}
}

/**
 * Owns the layered-button **rendering** (and nothing that mutates style): the draw elements, the per-element
 * conversion cache, the "what did the last draw depend on" tracking, the conversion to a draw style, and the
 * invalidation that follows from variable / composite-element / referenced-button changes.
 *
 * It is held by a control as `readonly drawing` (composition). Because this class has no style-editing methods
 * at all, a control that composes it is **read-only by construction** - there is no mutator to forget to
 * guard. The editable button composes `LayeredButtonStyleEditor` (a subclass that adds the editing ops).
 *
 * The `protected` element/cache/deps members are the surface that subclass exposes its editing operations on.
 */
export class LayeredButtonDrawer {
	protected readonly logger: Logger
	protected readonly deps: ControlDependencies
	protected readonly controlId: string
	readonly #host: LayeredButtonDrawerHost

	protected drawElementsList: SomeButtonGraphicsElement[] = []

	protected readonly elementConversionCache = new ElementConversionCache()

	/** Variables referenced by the last draw; a change evicts affected elements and (if drawn) redraws. */
	readonly #variables = new DrawDependency<string>((changed) =>
		this.elementConversionCache.queueInvalidateVariables(changed)
	)
	/** Composite element types used by the last draw. */
	readonly #compositeElements = new DrawDependency<CompositeElementIdString>((changed) =>
		this.elementConversionCache.queueInvalidateCompositeType(changed)
	)
	/** Location strings (e.g. '1/0/0') of buttons referenced via reference elements in the last draw. */
	readonly #referencedLocations = new DrawDependency<string>((changed) => {
		for (const location of changed) this.elementConversionCache.queueInvalidateReferencedLocation(location)
	})

	/**
	 * Variable changes seen while a draw is in flight. `getDrawStyle` is async, so a change can land after
	 * an element read the old value but before the draw's variables are committed - checking it against the
	 * stale set would drop it. Accumulated here and re-checked when the draw completes; `null` when idle.
	 */
	#variablesChangedDuringDraw: Set<string> | null = null
	/** Locations where a reference cycle was detected, to suppress redundant ∞ redraws. */
	#lastCyclicReferences: ReadonlySet<string> | null = null

	#lastDrawStyle: DrawStyleLayeredButtonModel | null = null

	/** The draw type to report (most buttons are 'button'; page buttons use 'pageup'/'pagedown'/'pagenum'). */
	readonly #drawType: DrawStyleLayeredButtonModel['drawType']

	constructor(
		deps: ControlDependencies,
		controlId: string,
		host: LayeredButtonDrawerHost,
		drawType: DrawStyleLayeredButtonModel['drawType'] = 'button'
	) {
		this.logger = LogController.createLogger(`Controls/Button/Drawer/${controlId}`)
		this.deps = deps
		this.controlId = controlId
		this.#host = host
		this.#drawType = drawType

		// Own the 'other control finished rendering' invalidation source, needed for reference elements
		this.deps.graphics.on('button_drawn', this.#onReferencedButtonDrawn)
	}

	dispose(): void {
		this.deps.graphics.off('button_drawn', this.#onReferencedButtonDrawn)
		// Cancel any redraw still queued so it can't fire after the owning control is gone
		this.invalidate.cancel()
		this.elementConversionCache.clear()
	}

	/**
	 * Request a re-render of this control's graphic. Debounced so rapid bursts of work coalesce into a single
	 * invalidation.
	 */
	invalidate = debounceFn(
		() => {
			if (this.#pendingDraw) return

			this.#pendingDraw = true
			setImmediate(() => {
				this.deps.events.emit('invalidateControlRender', this.controlId)
				this.#pendingDraw = false
			})
		},
		{
			before: false,
			after: true,
			wait: 10,
			maxWait: 20,
		}
	)
	#pendingDraw = false

	/**
	 * The draw elements, as a read-only view.
	 */
	get drawElements(): readonly SomeButtonGraphicsElement[] {
		return this.drawElementsList
	}

	getLastDrawStyle(): DrawStyleLayeredButtonModel | null {
		return this.#lastDrawStyle
	}

	/**
	 * Replace the draw elements (on load or on a preset refresh), normalising any missing/legacy properties,
	 * and clear the conversion cache.
	 */
	loadElements(elements: SomeButtonGraphicsElement[] | undefined): void {
		this.drawElementsList = elements || []

		// Ensure all properties are defined on elements as they are loaded
		for (const element of this.drawElementsList) {
			this.#normalizeLoadedElement(element)
		}

		this.elementConversionCache.clear()
	}

	/**
	 * Backfill missing properties and migrate legacy values on a loaded element, recursing into group children
	 * so that nested layers stay consistent with top-level ones.
	 */
	#normalizeLoadedElement(element: SomeButtonGraphicsElement): void {
		if (element.type !== 'canvas') {
			try {
				const defaults = CreateElementOfType(element.type)
				for (const key of Object.keys(defaults)) {
					if (key === 'id' || key === 'type' || key === 'name') continue
					if (!(key in element)) {
						;(element as any)[key] = (defaults as any)[key]
					}
				}
			} catch (_e) {
				// Ignore
			}
		}
		switch (element.type) {
			case 'canvas':
				if (!element.showStatusIcons)
					element.showStatusIcons = { value: ButtonGraphicsShowStatusIcons.FollowDefault, isExpression: false }
				break
			case 'image':
				if (!element.fillMode.isExpression && (element.fillMode.value as string) === 'fit_or_shrink') {
					element.fillMode.value = 'fit'
				}
				break
			case 'line': {
				// Line position used to reuse the box inside/center/outside enum, which is meaningless for a line
				const position = element.borderPosition.value
				if (!element.borderPosition.isExpression && (position === 'inside' || position === 'outside')) {
					element.borderPosition = { isExpression: false, value: 'center' }
				}
				break
			}
			case 'group':
				for (const child of element.children) {
					this.#normalizeLoadedElement(child)
				}
				break
		}
	}

	/** Compute the draw style of the button. */
	async getDrawStyle(): Promise<DrawStyleLayeredButtonModel> {
		// Arm mid-draw change tracking (see #variablesChangedDuringDraw). Draws are serialised per control,
		// so a single accumulator is safe.
		const changedDuringDraw = new Set<string>()
		this.#variablesChangedDuringDraw = changedDuringDraw
		try {
			const injectedVariableValues: VariableValues = {}
			const location = this.deps.pageStore.getLocationOfControlId(this.controlId)

			const parser = this.deps.variableValues.createVariablesAndExpressionParser(
				location,
				this.#host.entities?.getLocalVariableEntities() ?? null,
				injectedVariableValues
			)

			const locationStr = location ? formatLocation(location) : null

			const feedbackOverrides = this.#host.entities?.getFeedbackStyleOverrides() ?? emptyFeedbackOverrides

			const { elements, variables, compositeElements, referencedLocations, cyclicLocations } =
				await ConvertSomeButtonGraphicsElementForDrawing(
					this.deps.instance.definitions,
					parser,
					this.deps.graphics.renderPixelBuffers.bind(this.deps.graphics),
					this.drawElementsList,
					feedbackOverrides,
					true,
					this.elementConversionCache,
					locationStr,
					(location) => this.deps.graphics.getCachedRender(location) ?? null
				)
			this.#variables.commit(variables)
			this.#compositeElements.commit(compositeElements)
			this.#referencedLocations.commit(referencedLocations)
			this.#lastCyclicReferences = cyclicLocations.size > 0 ? cyclicLocations : null

			// Re-check any variable changes that landed mid-draw against the now-committed sets: evict their
			// stale cache entries and redraw if something drawn changed (see #variablesChangedDuringDraw).
			if (this.#variables.onChanged(changedDuringDraw)) this.invalidate()

			const result: DrawStyleLayeredButtonModel = {
				...this.#host.getButtonStateProps(),

				elements,
				referencedLocations: referencedLocations.drawn,

				style: 'button-layered',
				drawType: this.#drawType,
			}

			this.#lastDrawStyle = result
			return result
		} finally {
			this.#variablesChangedDuringDraw = null
		}
	}

	/** Propagate a variable change: invalidate affected cached elements and redraw if relevant. */
	onVariablesChanged(allChangedVariables: ReadonlySet<string>): void {
		// Record changes during an in-flight draw so getDrawStyle re-checks them (see #variablesChangedDuringDraw).
		if (this.#variablesChangedDuringDraw) {
			for (const variable of allChangedVariables) this.#variablesChangedDuringDraw.add(variable)
		}

		if (this.#variables.onChanged(allChangedVariables)) {
			this.logger.silly('variable changed in button ' + this.controlId)
			this.invalidate()
		}
	}

	/** The control was moved: any location-dependent drawing must be recomputed. */
	locationChanged(): void {
		this.elementConversionCache.clear()
		this.invalidate()
	}

	/** Run a references visitor (collector or updater) over the draw elements. */
	visit(visitor: DrawElementsVisitor): void {
		visitor.visitDrawElements(this.drawElementsList)
	}

	// ── Cache-invalidation hooks for the owning control's entity/runtime change path ──
	invalidateElement(id: string): void {
		this.elementConversionCache.queueInvalidate(id)
	}
	clearCache(): void {
		this.elementConversionCache.clear()
	}

	/**
	 * A composite element definition used by our cached style changed - invalidate and redraw if relevant.
	 * Called by the owning control from its existing `onCompositeElementsChanged` entry point.
	 */
	onCompositeElementsChanged(allChangedElementIds: ReadonlySet<CompositeElementIdString>): void {
		if (this.#compositeElements.onChanged(allChangedElementIds)) {
			this.logger.silly('composite element changed in button ' + this.controlId)
			this.invalidate()
		}
	}

	/** Another located control finished rendering; if we reference it, invalidate and redraw. */
	#onReferencedButtonDrawn = (location: ControlLocation, render: ImageResult): void => {
		const locStr = formatLocation(location)
		const changed: ReadonlySet<string> = new Set([locStr])

		// Suppress ping-pong for an established cycle before anything else: if we're already drawing ∞ for
		// this location AND the re-rendered target still references us back, no visible output would change.
		// (Only meaningful for a drawn ∞ placeholder; a hidden reference has none.)
		if (this.#referencedLocations.affectsDrawn(changed) && this.#lastCyclicReferences?.has(locStr)) {
			const myLocation = this.deps.pageStore.getLocationOfControlId(this.controlId)
			if (myLocation && render.referencedLocations.has(formatLocation(myLocation))) return
		}

		// Evict our (possibly stale) embedded snapshot of the target; redraw only if it is actually drawn.
		if (this.#referencedLocations.onChanged(changed)) {
			this.logger.silly('referenced control rendered in button ' + this.controlId)
			this.invalidate()
		}
	}
}
