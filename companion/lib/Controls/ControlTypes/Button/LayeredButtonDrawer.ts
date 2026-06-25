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
import { ConvertSomeButtonGraphicsElementForDrawing } from '../../../Graphics/ConvertGraphicsElements.js'
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

	/** The variables referenced in the last draw. When one changes, a redraw is needed. */
	#lastDrawVariables: ReadonlySet<string> | null = null
	#lastDrawCompositeElements: ReadonlySet<CompositeElementIdString> | null = null
	/** Location strings (e.g. '1/0/0') of buttons referenced via reference elements in the last draw. */
	#lastDrawReferencedLocations: ReadonlySet<string> | null = null
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

	/** The draw elements. Mutation lives on the editor subclass; this is for read/serialize. */
	get drawElements(): SomeButtonGraphicsElement[] {
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

		// HACK: temporary fill in new properties on loaded elements
		for (const element of this.drawElementsList) {
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
			}
		}

		this.elementConversionCache.clear()
	}

	/** Compute the draw style of the button. */
	async getDrawStyle(): Promise<DrawStyleLayeredButtonModel> {
		const injectedVariableValues: VariableValues = {}
		const location = this.deps.pageStore.getLocationOfControlId(this.controlId)

		const parser = this.deps.variableValues.createVariablesAndExpressionParser(
			location,
			this.#host.entities?.getLocalVariableEntities() ?? null,
			injectedVariableValues
		)

		const locationStr = location ? formatLocation(location) : null

		const feedbackOverrides = this.#host.entities?.getFeedbackStyleOverrides() ?? emptyFeedbackOverrides

		const { elements, usedVariables, usedCompositeElements, referencedLocations, cyclicLocations } =
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
		this.#lastDrawVariables = usedVariables.size > 0 ? usedVariables : null
		this.#lastDrawCompositeElements = usedCompositeElements.size > 0 ? usedCompositeElements : null
		this.#lastDrawReferencedLocations = referencedLocations.size > 0 ? referencedLocations : null
		this.#lastCyclicReferences = cyclicLocations.size > 0 ? cyclicLocations : null

		const result: DrawStyleLayeredButtonModel = {
			...this.#host.getButtonStateProps(),

			elements,
			referencedLocations,

			style: 'button-layered',
			drawType: this.#drawType,
		}

		this.#lastDrawStyle = result
		return result
	}

	/** Propagate a variable change: invalidate affected cached elements and redraw if relevant. */
	onVariablesChanged(allChangedVariables: ReadonlySet<string>): void {
		if (!this.#lastDrawVariables) return
		if (this.#lastDrawVariables.isDisjointFrom(allChangedVariables)) return

		this.elementConversionCache.queueInvalidateVariables(allChangedVariables)

		this.logger.silly('variable changed in button ' + this.controlId)
		this.invalidate()
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
		if (!this.#lastDrawCompositeElements) return
		if (this.#lastDrawCompositeElements.isDisjointFrom(allChangedElementIds)) return

		this.elementConversionCache.queueInvalidateCompositeType(allChangedElementIds)

		this.logger.silly('composite element changed in button ' + this.controlId)
		this.invalidate()
	}

	/** Another located control finished rendering; if we reference it, invalidate and redraw. */
	#onReferencedButtonDrawn = (location: ControlLocation, render: ImageResult): void => {
		const locStr = formatLocation(location)
		if (!this.#lastDrawReferencedLocations?.has(locStr)) return

		// Suppress ping-pong when we're already rendering a cycle: if we're already showing ∞ for this
		// location AND the target still references us back, no visible output would change.
		if (this.#lastCyclicReferences?.has(locStr)) {
			const myLocation = this.deps.pageStore.getLocationOfControlId(this.controlId)
			if (myLocation && render.referencedLocations.has(formatLocation(myLocation))) return
		}

		this.elementConversionCache.queueInvalidateReferencedLocation(locStr)
		this.logger.silly('referenced control rendered in button ' + this.controlId)
		this.invalidate()
	}
}
