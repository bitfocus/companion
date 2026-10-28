import EventEmitter from 'node:events'
import isEqual from 'fast-deep-equal'
import z from 'zod'
import { formatLocation } from '@companion-app/shared/ControlId.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import type { SomeButtonGraphicsDrawElement } from '@companion-app/shared/Model/StyleLayersModel.js'
import type { ControlCommonEvents } from '../Controls/ControlDependencies.js'
import type { ControlsController } from '../Controls/Controller.js'
import type { RenderClock } from '../Controls/RenderClock.js'
import type { GraphicsController } from '../Graphics/Controller.js'
import { ConvertSomeButtonGraphicsElementForDrawing } from '../Graphics/ConvertGraphicsElements.js'
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

/**
 * Manages streaming of individual button graphics elements, to the button editor preview.
 * Provides real-time updates when element expressions change or when the element definition is modified.
 *
 * An element is evaluated by a session, shared by everyone watching it. The streams of a preview are attached to its
 * preview context, and end with it.
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

						// Hold the context open until the client unsubscribes
						if (signal && !signal.aborted) {
							await new Promise<void>((resolve) => signal.addEventListener('abort', () => resolve(), { once: true }))
						}
					} finally {
						release()
					}
				}),

			/**
			 * Change the canvas of a preview context, for the elements the backend draws for it
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
					// Owned here, so that listeners are removed however the subscription ends
					const abort = new AbortController()
					signal?.addEventListener('abort', () => abort.abort(), { once: true })

					try {
						const context = await self.#contexts.waitFor(ctx.clientId, input.contextId, abort.signal)
						if (!context) return

						yield* self.#runSubscription(context, input.elementId, ctx.clientId, abort.signal)
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
		const session = this.#acquireSession(context.controlId, elementId, clientId)

		const wake = new EventEmitter<{ wake: [] }>()
		const onWake = () => wake.emit('wake')
		context.events.on('ended', onWake)
		session.changes.on('change', onWake)
		const wakes = toIterable(wake, 'wake', signal)

		try {
			let lastYielded = session.latestResult
			yield lastYielded

			while (!context.ended) {
				if (session.latestResult !== lastYielded) {
					lastYielded = session.latestResult
					yield lastYielded
					continue
				}

				const next = await wakes.next()
				if (next.done) return
			}
		} finally {
			context.events.off('ended', onWake)
			session.changes.off('change', onWake)
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
			isClockSensitive: false,
			latestResult: { ok: true, element: null },
			changes: new EventEmitter(),
			isEvaluating: false,
			hasPendingEvaluation: false,
		}
		session.changes.setMaxListeners(0)
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

	#onRenderClockTick = (): void => {
		for (const [, session] of this.#sessions) {
			if (!session.isClockSensitive) continue
			this.#triggerElementReEvaluation(session)
		}
	}

	#onElementChanged = (controlId: string, elementId: string): void => {
		// Find all sessions for this control and element
		for (const [elementStreamId, session] of this.#sessions) {
			if (session.controlId === controlId && session.elementId === elementId) {
				this.#logger.silly(`Re-evaluating element: ${elementStreamId} due to element change`)
				this.#triggerElementReEvaluation(session)
			}
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
			// Re-evaluate the element
			const newValue = await this.#evaluateElement(session.controlId, session.elementId)

			// Update session with new value
			session.trackedExpressions = newValue.referencedVariableIds
			session.trackedCompositeElements = newValue.referencedCompositeElements
			session.trackedReferencedLocations = newValue.referencedLocations
			session.isClockSensitive = newValue.clockSensitive

			// Re-evaluations often produce the same result (eg on a render clock tick), so skip resending those
			if (!isEqual(session.latestResult.element, newValue.element)) {
				session.latestResult = { ok: true, element: newValue.element }
				session.changes.emit('change')
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

	async #evaluateElement(
		controlId: string,
		elementId: string
	): Promise<{
		element: SomeButtonGraphicsDrawElement | null
		referencedVariableIds: Set<string>
		referencedCompositeElements: Set<CompositeElementIdString>
		referencedLocations: Set<string>
		clockSensitive: boolean
	}> {
		const control = this.#controlsController.getControl(controlId)
		if (!control || !control.supportsLayeredStyle || !control.supportsEntities) {
			return {
				element: null,
				referencedVariableIds: new Set(),
				referencedCompositeElements: new Set(),
				referencedLocations: new Set(),
				clockSensitive: false,
			}
		}

		const elementDef = control.layeredStyleGetElementById(elementId)
		if (!elementDef) {
			return {
				element: null,
				referencedVariableIds: new Set(),
				referencedCompositeElements: new Set(),
				referencedLocations: new Set(),
				clockSensitive: false,
			}
		}

		const feedbackOverrides = control.entities.getFeedbackStyleOverrides(control.drawing?.resolveDefaultNoTopBar())

		if (!elementDef) {
			return {
				element: null,
				referencedVariableIds: new Set(),
				referencedCompositeElements: new Set(),
				referencedLocations: new Set(),
				clockSensitive: false,
			}
		}

		const parser = this.#controlsController.createVariablesAndExpressionParser(controlId)

		const controlLocation = this.#pageStore.getLocationOfControlId(controlId)
		const currentLocationStr = controlLocation ? formatLocation(controlLocation) : null

		try {
			// For group elements, clear children since they should be watched independently
			// Reference elements keep their children (embedded from referenced control)
			let elementDefToProcess = elementDef
			if (elementDef.type === 'group') {
				elementDefToProcess = { ...elementDef, children: [] }
			}

			// Convert the single element to its draw representation
			// We wrap it in an array since ConvertSomeButtonGraphicsElementForDrawing expects an array
			const { elements, variables, compositeElements, referencedLocations, clockSensitive } =
				await ConvertSomeButtonGraphicsElementForDrawing(
					this.#instanceDefinitions,
					parser,
					this.#graphicsController.renderPixelBuffers.bind(this.#graphicsController),
					[elementDefToProcess],
					feedbackOverrides,
					false, // onlyEnabled
					null,
					currentLocationStr,
					(location) => this.#graphicsController.getCachedRender(location) ?? null
				)

			if (elements.length === 0) {
				throw new Error(
					`Element conversion resulted in no elements (element id: ${elementDef.id ?? 'unknown'}, type: ${elementDef.type ?? 'unknown'})`
				)
			}

			// This path passes cache:null + onlyEnabled:false, so every element is drawn and the hidden sets
			// are always empty; only the drawn half is meaningful here.
			return {
				element: elements[0],
				referencedVariableIds: variables.drawn,
				referencedCompositeElements: compositeElements.drawn,
				referencedLocations: referencedLocations.drawn,
				clockSensitive,
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
	isClockSensitive: boolean

	latestResult: ElementStreamResult

	readonly changes: EventEmitter<{ change: [] }>
	isEvaluating: boolean
	hasPendingEvaluation: boolean
}
