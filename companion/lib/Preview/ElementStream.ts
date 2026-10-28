import EventEmitter from 'node:events'
import { aborted } from 'node:util'
import isEqual from 'fast-deep-equal'
import z from 'zod'
import { formatLocation } from '@companion-app/shared/ControlId.js'
import { RASTERISED_ELEMENT_TYPES, type ElementRasterCanvas } from '@companion-app/shared/Graphics/ElementRaster.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import type {
	ButtonGraphicsRasterDrawElement,
	SomeButtonGraphicsDrawElement,
	SomeButtonGraphicsElement,
} from '@companion-app/shared/Model/StyleLayersModel.js'
import type { ControlCommonEvents } from '../Controls/ControlDependencies.js'
import type { ControlsController } from '../Controls/Controller.js'
import type { RenderClock } from '../Controls/RenderClock.js'
import type { GraphicsController } from '../Graphics/Controller.js'
import { ConvertSomeButtonGraphicsElementForDrawing } from '../Graphics/ConvertGraphicsElements.js'
import type { DrawnElementRaster } from '../Graphics/Renderer.js'
import type { CompositeElementIdString, InstanceDefinitions } from '../Instance/Definitions.js'
import LogController from '../Log/Controller.js'
import type { IPageStore } from '../Page/Store.js'
import { publicProcedure, router, toIterable } from '../UI/TRPC.js'
import { PreviewContexts, type PreviewContext } from './PreviewContexts.js'

export interface ElementStreamResult {
	ok: true
	element: SomeButtonGraphicsDrawElement | null
}

/** Largest canvas an element can be rasterised for, to bound the work a client can request */
const MAX_RASTER_CANVAS_SIZE = 4096

/** The least time between rendering the rasters of an element for a canvas, to bound the cost of rapid changes */
const RASTER_RENDER_MIN_INTERVAL_MS = 50

/** A canvas to rasterise an element for, whose padding must leave some room for the button */
export const ElementRasterCanvasSchema = z
	.object({
		width: z.number().int().min(1).max(MAX_RASTER_CANVAS_SIZE),
		height: z.number().int().min(1).max(MAX_RASTER_CANVAS_SIZE),
		paddingX: z.number().int().min(0),
		paddingY: z.number().int().min(0),
	})
	.refine((canvas) => canvas.paddingX * 2 < canvas.width && canvas.paddingY * 2 < canvas.height, {
		message: 'Canvas padding must leave room for the button',
	})

/** An element evaluated by a session, independent of any canvas */
interface EvaluatedElement {
	element: SomeButtonGraphicsDrawElement | null
	/** The ids of the element and anything inside it to rasterise (see RASTERISED_ELEMENT_TYPES) */
	rasterIds: string[]
	/** The draw elements of the path to the element (the canvas and its ancestors), to rasterise from */
	pathElements: SomeButtonGraphicsDrawElement[]
	/** The ids of the button's own elements which a change to affects this one: itself, and if it is rasterised, its path */
	dependsOnElementIds: ReadonlySet<string>
}

interface EvaluatedSession {
	result: EvaluatedElement
	referencedVariableIds: Set<string>
	referencedCompositeElements: Set<CompositeElementIdString>
	referencedLocations: Set<string>
	clockSensitive: boolean
}

/**
 * Manages streaming of individual button graphics elements, to the button editor preview.
 * Provides real-time updates when element expressions change or when the element definition is modified.
 *
 * An element is evaluated by a session, shared by everyone watching it. The streams of a preview are attached to its
 * preview context, and receive the elements in RASTERISED_ELEMENT_TYPES as `raster` elements, drawn by the backend
 * for the canvas of their context. That is done by a view of the session for each canvas.
 */
export class PreviewElementStream {
	readonly #logger = LogController.createLogger('Preview/ElementStream')

	readonly #instanceDefinitions: InstanceDefinitions
	readonly #graphicsController: GraphicsController
	readonly #pageStore: IPageStore
	readonly #controlsController: ControlsController
	readonly #controlEvents: EventEmitter<ControlCommonEvents>

	readonly #contexts = new PreviewContexts()
	readonly #sessions = new Map<string, ElementStreamSession>()

	readonly #unsubscribeRenderClock: () => void

	constructor(
		instanceDefinitions: InstanceDefinitions,
		graphicsController: GraphicsController,
		pageStore: IPageStore,
		controlsController: ControlsController,
		controlEvents: EventEmitter<ControlCommonEvents>,
		renderClock: RenderClock
	) {
		this.#instanceDefinitions = instanceDefinitions
		this.#graphicsController = graphicsController
		this.#pageStore = pageStore
		this.#controlsController = controlsController
		this.#controlEvents = controlEvents

		// Listen for element changes to trigger re-evaluation
		this.#controlEvents.on('layeredStyleElementChanged', this.#onElementChanged)
		this.#graphicsController.on('button_drawn', this.#onButtonDrawn)

		this.#unsubscribeRenderClock = renderClock.subscribe(() => this.#onRenderClockTick())
	}

	destroy(): void {
		this.#unsubscribeRenderClock()
	}

	createTrpcRouter() {
		const self = this
		return router({
			/**
			 * Open a preview context, for element streams to attach to. It stays open for as long as this
			 * subscription runs, and the element streams attached to it end with it.
			 *
			 * @param contextId - ID of the context, chosen by the client, so that it is unchanged after a reconnect
			 * @param controlId - ID of the control being previewed
			 * @param canvas - The canvas the preview draws the control on
			 */
			previewContext: publicProcedure
				.input(
					z.object({
						contextId: z.string(),
						controlId: z.string(),
						canvas: ElementRasterCanvasSchema,
					})
				)
				.subscription(async function* ({ input, signal, ctx }) {
					const release = self.#contexts.open(ctx.clientId, input.contextId, input.controlId, input.canvas)
					try {
						yield { ok: true as const }

						// Hold the context open until the client unsubscribes. The signal is the resource held weakly, as it
						// lives as long as the subscription
						if (signal) await aborted(signal, signal)
					} finally {
						release()
					}
				}),

			/**
			 * Change the canvas of a preview context, re-rendering the rasters of its element streams
			 */
			setPreviewCanvas: publicProcedure
				.input(
					z.object({
						contextId: z.string(),
						canvas: ElementRasterCanvasSchema,
					})
				)
				.mutation(({ input, ctx }) => self.#contexts.setCanvas(ctx.clientId, input.contextId, input.canvas)),

			/**
			 * Watch a specific element of the control of a preview context, for changes.
			 * Returns a stream of ElementStreamResult objects containing the evaluated element.
			 * Returns null if the element doesn't exist.
			 * Any of RASTERISED_ELEMENT_TYPES in it are replaced with `raster` elements, drawn for the canvas of the context.
			 *
			 * @param contextId - ID of the preview context
			 * @param elementId - ID of the element to watch
			 */
			watchElement: publicProcedure
				.input(
					z.object({
						contextId: z.string(),
						elementId: z.string(),
					})
				)
				.subscription(async function* ({ input, signal, ctx }) {
					// Aborted here too, so that listeners are removed however the subscription ends
					const abort = new AbortController()
					const subscriptionSignal = signal ? AbortSignal.any([signal, abort.signal]) : abort.signal

					try {
						const context = await self.#contexts.waitFor(ctx.clientId, input.contextId, subscriptionSignal)
						if (!context) return

						yield* self.#runSubscription(context, input.elementId, ctx.clientId, subscriptionSignal)
					} finally {
						abort.abort()
					}
				}),
		})
	}

	/**
	 * Stream an element for a preview context, until either ends
	 */
	async *#runSubscription(
		context: PreviewContext,
		elementId: string,
		clientId: string,
		signal: AbortSignal
	): AsyncGenerator<ElementStreamResult> {
		// Already ended, so there is nothing to start
		if (signal.aborted) return

		const session = this.#acquireSession(context.controlId, elementId, clientId)
		let view = this.#acquireView(session, context.canvas)

		const wake = new EventEmitter<{ wake: [] }>()
		const onWake = () => wake.emit('wake')

		try {
			context.events.on('canvasChanged', onWake)
			context.events.on('ended', onWake)
			view.events.on('output', onWake)
			const wakes = toIterable(wake, 'wake', signal)

			// Start with a null element until the first evaluation, as a new client to an existing view gets its output
			let lastYielded: ElementStreamResult = view.output ?? { ok: true, element: null }
			yield lastYielded

			while (!context.ended) {
				if (canvasKey(context.canvas) !== view.canvasKey) {
					// Move to a view for the new canvas. Its output, if any, replaces what was sent for the old one
					view.events.off('output', onWake)
					this.#releaseView(session, view)
					view = this.#acquireView(session, context.canvas)
					view.events.on('output', onWake)
				}

				// Keep what was sent until there is something newer, so a view still rendering doesn't blank anything
				const output = view.output
				if (output && !isEqual(output, lastYielded)) {
					lastYielded = output
					yield output
					continue
				}

				const next = await wakes.next()
				if (next.done) return
			}
		} finally {
			context.events.off('canvasChanged', onWake)
			context.events.off('ended', onWake)
			view.events.off('output', onWake)
			this.#releaseView(session, view)
			this.#releaseSession(session, clientId)
		}
	}

	#acquireSession(controlId: string, elementId: string, clientId: string): ElementStreamSession {
		const sessionId = `${controlId}::${elementId}`

		let session = this.#sessions.get(sessionId)
		if (session) {
			this.#logger.debug(`Client "${clientId}" subscribed to existing element session: ${sessionId}`)
			session.subscribers++
			return session
		}

		this.#logger.debug(`Client "${clientId}" subscribed to new element session: ${sessionId}`)
		session = {
			sessionId,
			controlId,
			elementId,
			subscribers: 1,
			trackedExpressions: new Set<string>(),
			trackedCompositeElements: new Set(),
			trackedReferencedLocations: new Set(),
			dependsOnElementIds: new Set([elementId]),
			isClockSensitive: false,
			latest: null,
			views: new Map(),
			isEvaluating: false,
			hasPendingEvaluation: false,
		}
		this.#sessions.set(sessionId, session)

		// Trigger async evaluation of the initial value
		this.#triggerElementReEvaluation(session)

		return session
	}

	#releaseSession(session: ElementStreamSession, clientId: string): void {
		this.#logger.debug(`Client "${clientId}" unsubscribed from element session: ${session.sessionId}`)

		session.subscribers--
		if (session.subscribers > 0) return

		this.#sessions.delete(session.sessionId)
		this.#logger.debug(`Element session "${session.sessionId}" has no more clients, terminated`)
	}

	#acquireView(session: ElementStreamSession, canvas: ElementRasterCanvas): RasterView {
		const key = canvasKey(canvas)

		let view = session.views.get(key)
		if (!view) {
			view = new RasterView(key, canvas, this.#renderRasters)
			session.views.set(key, view)
			if (session.latest) view.update(session.latest)
		}
		view.subscribers++

		return view
	}

	#releaseView(session: ElementStreamSession, view: RasterView): void {
		view.subscribers--
		if (view.subscribers > 0) return

		view.dispose()
		if (session.views.get(view.canvasKey) === view) session.views.delete(view.canvasKey)
	}

	/** Render the rasters of an evaluated element for a canvas, replacing those elements with them */
	#renderRasters = async (evaluated: EvaluatedElement, canvas: ElementRasterCanvas): Promise<ElementStreamResult> => {
		if (!evaluated.element || evaluated.rasterIds.length === 0) return { ok: true, element: evaluated.element }

		const images = new Map<string, DrawnElementRaster>()
		await Promise.all(
			evaluated.rasterIds.map(async (rasterId) => {
				const raster = await this.#graphicsController.renderElementRaster(evaluated.pathElements, rasterId, canvas)
				if (raster) images.set(rasterId, raster)
			})
		)

		return { ok: true, element: replaceWithRasters(evaluated.element, images) }
	}

	#onRenderClockTick = (): void => {
		for (const [, session] of this.#sessions) {
			if (!session.isClockSensitive) continue
			this.#triggerElementReEvaluation(session)
		}
	}

	#onElementChanged = (controlId: string, elementId: string): void => {
		for (const [elementStreamId, session] of this.#sessions) {
			if (session.controlId !== controlId || !session.dependsOnElementIds.has(elementId)) continue

			this.#logger.silly(`Re-evaluating element: ${elementStreamId} due to element change`)
			this.#triggerElementReEvaluation(session)
		}
	}

	#onButtonDrawn = (location: ControlLocation): void => {
		const locationStr = formatLocation(location)
		// Re-evaluate sessions that reference this location
		for (const [elementStreamId, session] of this.#sessions) {
			if (session.trackedReferencedLocations.has(locationStr)) {
				this.#logger.silly(`Re-evaluating element: ${elementStreamId} due to button drawn`)
				this.#triggerElementReEvaluation(session)
			}
		}
	}

	#triggerElementReEvaluation = (session: ElementStreamSession): void => {
		if (session.isEvaluating) {
			// Already evaluating, just mark that another evaluation is needed
			session.hasPendingEvaluation = true
			return
		}

		// Start evaluation without waiting for it
		void this.#performElementReEvaluation(session)
	}

	#performElementReEvaluation = async (session: ElementStreamSession): Promise<void> => {
		// Mark as evaluating and clear pending flag
		session.isEvaluating = true
		session.hasPendingEvaluation = false

		try {
			const newValue = await this.#evaluateElement(session.controlId, session.elementId)

			// Update session with new value
			session.trackedExpressions = newValue.referencedVariableIds
			session.trackedCompositeElements = newValue.referencedCompositeElements
			session.trackedReferencedLocations = newValue.referencedLocations
			session.dependsOnElementIds = newValue.result.dependsOnElementIds
			session.isClockSensitive = newValue.clockSensitive

			// Re-evaluations often produce the same result (eg on a render clock tick), so skip rendering those
			if (!session.latest || !isSameEvaluation(session.latest, newValue.result)) {
				session.latest = newValue.result
				for (const view of session.views.values()) view.update(newValue.result)
			}
		} catch (err) {
			this.#logger.error(`Error re-evaluating element ${session.sessionId}:`, err)
		} finally {
			// Mark evaluation as complete
			session.isEvaluating = false

			// If another evaluation was requested while we were running, do it now
			if (session.hasPendingEvaluation) {
				// Use setImmediate to avoid deep recursion
				setImmediate(() => {
					void this.#performElementReEvaluation(session)
				})
			}
		}
	}

	onVariablesChanged = (changed: ReadonlySet<string>, controlIdFilter: ReadonlySet<string> | null): void => {
		for (const [elementStreamId, session] of this.#sessions) {
			if (controlIdFilter && !controlIdFilter.has(session.controlId)) continue

			// Check if any of the changed variables are used by this element
			if (session.trackedExpressions.isDisjointFrom(changed)) continue

			this.#logger.silly(`Re-evaluating element: ${elementStreamId} for ${session.subscribers} clients`)

			this.#triggerElementReEvaluation(session)
		}
	}

	onConnectionCompositeElementsChanged = (elementIds: ReadonlySet<CompositeElementIdString>): void => {
		for (const [elementStreamId, session] of this.#sessions) {
			if (session.trackedCompositeElements.size === 0) continue
			if (session.trackedCompositeElements.isDisjointFrom(elementIds)) continue

			this.#logger.silly(`Re-evaluating element: ${elementStreamId} for ${session.subscribers} clients`)

			this.#triggerElementReEvaluation(session)
		}
	}

	async #evaluateElement(controlId: string, elementId: string): Promise<EvaluatedSession> {
		const emptyResult: EvaluatedSession = {
			result: { element: null, rasterIds: [], pathElements: [], dependsOnElementIds: new Set([elementId]) },
			referencedVariableIds: new Set(),
			referencedCompositeElements: new Set(),
			referencedLocations: new Set(),
			clockSensitive: false,
		}

		const control = this.#controlsController.getControl(controlId)
		if (!control || !control.supportsLayeredStyle || !control.supportsEntities) return emptyResult

		const elementDef = control.layeredStyleGetElementById(elementId)
		if (!elementDef) return emptyResult

		const feedbackOverrides = control.entities.getFeedbackStyleOverrides(control.drawing?.resolveDefaultNoTopBar())
		const parser = this.#controlsController.createVariablesAndExpressionParser(controlId)

		const controlLocation = this.#pageStore.getLocationOfControlId(controlId)
		const currentLocationStr = controlLocation ? formatLocation(controlLocation) : null

		const convert = async (elements: SomeButtonGraphicsElement[]) =>
			ConvertSomeButtonGraphicsElementForDrawing(
				this.#instanceDefinitions,
				parser,
				this.#graphicsController.renderPixelBuffers.bind(this.#graphicsController),
				elements,
				feedbackOverrides,
				false, // onlyEnabled
				null,
				currentLocationStr,
				(location) => this.#graphicsController.getCachedRender(location) ?? null
			)

		try {
			// For group elements, clear children since they should be watched independently
			// Reference elements keep their children (embedded from referenced control)
			const elementDefToProcess: SomeButtonGraphicsElement =
				elementDef.type === 'group' ? { ...elementDef, children: [] } : elementDef

			// Convert the single element to its draw representation
			const converted = await convert([elementDefToProcess])
			const element = converted.elements[0]
			if (!element) {
				throw new Error(
					`Element conversion resulted in no elements (element id: ${elementDef.id}, type: ${elementDef.type})`
				)
			}

			// A rasterised element is drawn with the layout of its parents, so that path is converted too, and
			// a change to any of it affects the element
			const rasterIds = collectRasterIds(element)
			const rawPath =
				rasterIds.length > 0 ? pruneRawElementsToTarget(control.layeredStyleGetElements(), elementId) : null
			const fromPath = rawPath ? await convert(rawPath) : null

			const references = fromPath ?? converted

			// This path passes cache:null + onlyEnabled:false, so every element is drawn and the hidden sets
			// are always empty; only the drawn half is meaningful here.
			return {
				result: {
					element,
					rasterIds,
					pathElements: fromPath?.elements ?? [],
					dependsOnElementIds: new Set(rawPath ? collectRawIds(rawPath) : [elementId]),
				},
				referencedVariableIds: references.variables.drawn,
				referencedCompositeElements: references.compositeElements.drawn,
				referencedLocations: references.referencedLocations.drawn,
				clockSensitive: references.clockSensitive,
			}
		} catch (error) {
			this.#logger.error('Error evaluating element:', error)
			throw error
		}
	}
}

interface ElementStreamSession {
	readonly sessionId: string
	readonly controlId: string
	readonly elementId: string
	subscribers: number
	trackedExpressions: Set<string>
	trackedCompositeElements: Set<CompositeElementIdString>
	trackedReferencedLocations: Set<string>
	dependsOnElementIds: ReadonlySet<string>
	isClockSensitive: boolean

	/** The latest evaluation, or null until the first completes */
	latest: EvaluatedElement | null
	/** The views of the element, one for each canvas it is watched for */
	readonly views: Map<string, RasterView>

	isEvaluating: boolean
	hasPendingEvaluation: boolean
}

/**
 * An evaluated element as streamed for one canvas, with its rasters rendered for that canvas.
 * Renders are throttled to at most one per RASTER_RENDER_MIN_INTERVAL_MS, always ending with the latest evaluation.
 */
class RasterView {
	readonly canvasKey: string
	readonly #canvas: ElementRasterCanvas
	readonly #render: (evaluated: EvaluatedElement, canvas: ElementRasterCanvas) => Promise<ElementStreamResult>

	readonly events = new EventEmitter<{ output: [] }>()
	subscribers = 0

	/** The latest output, or null until the first is ready */
	output: ElementStreamResult | null = null

	#latest: EvaluatedElement | null = null
	/** Counts the evaluations given to `update`, so a render can tell whether its output has been superseded */
	#updateCount = 0
	/** The `#updateCount` of the evaluation the output is from */
	#outputUpdate = 0
	#isRendering = false
	#hasPendingRender = false
	#lastRenderStart = 0
	#timer: NodeJS.Timeout | null = null
	#disposed = false

	constructor(
		canvasKey: string,
		canvas: ElementRasterCanvas,
		render: (evaluated: EvaluatedElement, canvas: ElementRasterCanvas) => Promise<ElementStreamResult>
	) {
		this.canvasKey = canvasKey
		this.#canvas = canvas
		this.#render = render
		this.events.setMaxListeners(0)
	}

	dispose(): void {
		this.#disposed = true
		if (this.#timer) clearTimeout(this.#timer)
		this.#timer = null
	}

	update(evaluated: EvaluatedElement): void {
		this.#latest = evaluated
		this.#updateCount++

		// Nothing to render, so there is nothing to throttle
		if (!evaluated.element || evaluated.rasterIds.length === 0) {
			this.#setOutput({ ok: true, element: evaluated.element }, this.#updateCount)
			return
		}

		this.#schedule()
	}

	#setOutput(output: ElementStreamResult, fromUpdate: number): void {
		this.#outputUpdate = fromUpdate
		if (this.output && isEqual(this.output, output)) return
		this.output = output
		this.events.emit('output')
	}

	#schedule(): void {
		if (this.#disposed) return
		if (this.#isRendering) {
			this.#hasPendingRender = true
			return
		}
		if (this.#timer) return

		const delay = this.#lastRenderStart + RASTER_RENDER_MIN_INTERVAL_MS - Date.now()
		if (delay > 0) {
			this.#timer = setTimeout(() => {
				this.#timer = null
				void this.#performRender()
			}, delay)
		} else {
			void this.#performRender()
		}
	}

	async #performRender(): Promise<void> {
		const evaluated = this.#latest
		const fromUpdate = this.#updateCount
		if (this.#disposed || !evaluated) return

		this.#isRendering = true
		this.#hasPendingRender = false
		this.#lastRenderStart = Date.now()

		try {
			const output = await this.#render(evaluated, this.#canvas)
			// Sent even if there is a newer evaluation to render, so a stream of changes still shows each render. But
			// not if a newer evaluation without anything to render has replaced it already
			if (!this.#disposed && fromUpdate > this.#outputUpdate) this.#setOutput(output, fromUpdate)
		} catch (e) {
			LogController.createLogger('Preview/ElementStream').error(`Error rendering element rasters:`, e)
		} finally {
			this.#isRendering = false
			if (this.#hasPendingRender) this.#schedule()
		}
	}
}

/** Whether two evaluations would stream the same, ignoring what they depend on */
function isSameEvaluation(a: EvaluatedElement, b: EvaluatedElement): boolean {
	return isEqual(a.element, b.element) && isEqual(a.rasterIds, b.rasterIds) && isEqual(a.pathElements, b.pathElements)
}

function canvasKey(canvas: ElementRasterCanvas): string {
	return `${canvas.width}x${canvas.height}::${canvas.paddingX}x${canvas.paddingY}`
}

/** The ids of an element and its content (eg of a composite or reference) to rasterise */
function collectRasterIds(element: SomeButtonGraphicsDrawElement): string[] {
	if (RASTERISED_ELEMENT_TYPES.has(element.type)) return [element.id]
	if (element.type === 'group' || element.type === 'reference') return element.children.flatMap(collectRasterIds)
	return []
}

/** Replace the elements which have been rasterised with `raster` elements of their images */
function replaceWithRasters(
	element: SomeButtonGraphicsDrawElement,
	images: ReadonlyMap<string, DrawnElementRaster>
): SomeButtonGraphicsDrawElement {
	const drawn = images.get(element.id)
	if (drawn && element.type !== 'canvas') {
		const raster: ButtonGraphicsRasterDrawElement = {
			id: element.id,
			type: 'raster',
			usage: element.usage,
			enabled: element.enabled,
			opacity: element.opacity,
			x: 'x' in element ? element.x : 0,
			y: 'y' in element ? element.y : 0,
			width: 'width' in element ? element.width : 1,
			height: 'height' in element ? element.height : 1,
			rotation: 'rotation' in element ? element.rotation : 0,
			image: drawn.image,
			renderedAt: drawn.renderedAt,
			contentHash: element.contentHash,
		}
		return raster
	}

	if (element.type === 'group' || element.type === 'reference') {
		return { ...element, children: element.children.map((child) => replaceWithRasters(child, images)) }
	}
	return element
}

function collectRawIds(elements: readonly SomeButtonGraphicsElement[]): string[] {
	return elements.flatMap((element) => [
		element.id,
		...(element.type === 'group' ? collectRawIds(element.children) : []),
	])
}

/**
 * Reduce a button's elements to just the canvas (which sets the decoration, and so the content area) and the
 * path to the given element, as nothing else affects how it is laid out
 * @returns The pruned elements, or null if the element was not found
 */
export function pruneRawElementsToTarget(
	elements: readonly SomeButtonGraphicsElement[],
	elementId: string
): SomeButtonGraphicsElement[] | null {
	const prunePath = (elements: readonly SomeButtonGraphicsElement[]): SomeButtonGraphicsElement[] | null => {
		for (const element of elements) {
			if (element.id === elementId) return [element]

			if (element.type === 'group') {
				const children = prunePath(element.children)
				if (children) return [{ ...element, children }]
			}
		}
		return null
	}

	const path = prunePath(elements)
	if (!path) return null

	const canvasElement = elements.find((element) => element.type === 'canvas')
	return canvasElement && canvasElement !== path[0] ? [canvasElement, ...path] : path
}
