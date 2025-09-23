import LogController from '../Log/Controller.js'
import type { ControlsController } from '../Controls/Controller.js'
import { publicProcedure, router, toIterable } from '../UI/TRPC.js'
import z from 'zod'
import EventEmitter from 'node:events'
import type { SomeButtonGraphicsDrawElement } from '@companion-app/shared/Model/StyleLayersModel.js'
import { ConvertSomeButtonGraphicsElementForDrawing } from '../Graphics/ConvertGraphicsElements.js'
import type { ExecuteExpressionResult } from '@companion-app/shared/Expression/ExpressionResult.js'
import type { ControlCommonEvents } from '../Controls/ControlDependencies.js'

export interface ElementStreamResult {
	ok: true
	element: SomeButtonGraphicsDrawElement | null
}

/**
 * Manages streaming of individual button graphics elements.
 * Provides real-time updates when element expressions change or when the element definition is modified.
 */

export class PreviewElementStream {
	readonly #logger = LogController.createLogger('Preview/ElementStream')

	readonly #controlsController: ControlsController
	readonly #controlEvents: EventEmitter<ControlCommonEvents>

	readonly #sessions = new Map<string, ElementStreamSession>()

	constructor(controlsController: ControlsController, controlEvents: EventEmitter<ControlCommonEvents>) {
		this.#controlsController = controlsController
		this.#controlEvents = controlEvents

		// Listen for element changes to trigger re-evaluation
		this.#controlEvents.on('layeredStyleElementChanged', this.#onElementChanged)
	}

	createTrpcRouter() {
		const self = this
		return router({
			/**
			 * Watch a specific element for changes.
			 * Returns a stream of ElementStreamResult objects containing the evaluated element.
			 * Returns null if the element doesn't exist.
			 *
			 * @param controlId - ID of the control containing the element
			 * @param elementId - ID of the element to watch
			 */
			watchElement: publicProcedure
				.input(
					z.object({
						controlId: z.string(),
						elementId: z.string(),
					})
				)
				.subscription(async function* ({ input, signal, ctx }) {
					const elementStreamId = `${input.controlId}::${input.elementId}`
					let session = self.#sessions.get(elementStreamId)

					try {
						if (!session) {
							self.#logger.debug(`Client "${ctx.clientId}" subscribed to new element session: ${elementStreamId}`)

							// Create session immediately with null value to prevent race conditions
							session = {
								elementStreamId,
								controlId: input.controlId,
								elementId: input.elementId,
								trackedExpressions: new Set<string>(),

								latestResult: { ok: true, element: null },
								changes: new EventEmitter(),
								isEvaluating: false,
								hasPendingEvaluation: false,
							}
							self.#sessions.set(elementStreamId, session)

							// Trigger async evaluation of the initial value
							self.#triggerElementReEvaluation(session)
						} else {
							self.#logger.debug(`Client "${ctx.clientId}" subscribed to existing element session: ${elementStreamId}`)
						}

						const changes = toIterable(session.changes, 'change', signal)

						yield session.latestResult

						for await (const [change] of changes) {
							yield change
						}
					} finally {
						self.#logger.debug(`Client "${ctx.clientId}" unsubscribed from element session: ${elementStreamId}`)

						// Stop the session if no clients are left
						if (session && session.changes.listenerCount('change') === 0) {
							self.#sessions.delete(elementStreamId)

							self.#logger.debug(`Element session "${elementStreamId}" has no more clients, terminated`)
						}
					}
				}),
		})
	}

	#onElementChanged = (controlId: string, elementId: string): void => {
		// Find all sessions for this control and element
		for (const [elementStreamId, session] of this.#sessions) {
			if (session.controlId === controlId && session.elementId === elementId) {
				this.#logger.debug(`Re-evaluating element: ${elementStreamId} due to element change`)
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
			session.latestResult = { ok: true, element: newValue.element }
			session.trackedExpressions = newValue.referencedVariableIds

			session.changes.emit('change', { ok: true, element: newValue.element })
		} catch (err) {
			this.#logger.error(`Error re-evaluating element ${session.elementStreamId}:`, err)
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

	onVariablesChanged = (changed: Set<string>, fromControlId: string | null): void => {
		for (const [elementStreamId, session] of this.#sessions) {
			if (fromControlId && session.controlId !== fromControlId) continue

			// Check if any of the changed variables are used by this element
			let shouldRecompute = false
			for (const variableId of changed) {
				if (session.trackedExpressions.has(variableId)) {
					shouldRecompute = true
					break
				}
			}

			if (shouldRecompute) {
				this.#logger.debug(
					`Re-evaluating element: ${elementStreamId} for ${session.changes.listenerCount('change')} clients`
				)

				this.#triggerElementReEvaluation(session)
			}
		}
	}

	async #evaluateElement(
		controlId: string,
		elementId: string
	): Promise<{
		element: SomeButtonGraphicsDrawElement | null
		referencedVariableIds: Set<string>
	}> {
		const referencedVariableIds = new Set<string>()

		const control = this.#controlsController.getControl(controlId)
		if (!control || !control.supportsLayeredStyle || !control.supportsEntities) {
			return { element: null, referencedVariableIds }
		}

		const elementDef = control.layeredStyleGetElementById(elementId)
		if (!elementDef) {
			return { element: null, referencedVariableIds }
		}

		const feedbackOverrides = control.entities.getFeedbackStyleOverrides()

		if (!elementDef) {
			return { element: null, referencedVariableIds }
		}

		const parser = this.#controlsController.createVariablesAndExpressionParser(controlId, null)

		// Create the expression execution functions that track variable usage
		const parseExpression = async (str: string, requiredType?: string): Promise<ExecuteExpressionResult> => {
			const result = parser.executeExpression(str, requiredType)

			// Track all variables used in this expression
			for (const variableId of result.variableIds) {
				referencedVariableIds.add(variableId)
			}

			return result
		}

		const parseVariablesInString = async (str: string): Promise<ExecuteExpressionResult> => {
			const result = parser.parseVariables(str)

			// Track all variables used
			for (const variableId of result.variableIds) {
				referencedVariableIds.add(variableId)
			}

			return {
				ok: true,
				value: result.text,
				variableIds: result.variableIds,
			}
		}

		try {
			// For group elements, clear children since they should be watched independently
			let elementDefToProcess = elementDef
			if (elementDef.type === 'group') {
				elementDefToProcess = { ...elementDef, children: [] }
			}

			// Convert the single element to its draw representation
			// We wrap it in an array since ConvertSomeButtonGraphicsElementForDrawing expects an array
			const { elements } = await ConvertSomeButtonGraphicsElementForDrawing(
				[elementDefToProcess],
				feedbackOverrides,
				parseExpression,
				parseVariablesInString,
				false // onlyEnabled
			)

			if (elements.length === 0) {
				throw new Error(
					`Element conversion resulted in no elements (element id: ${elementDef.id ?? 'unknown'}, type: ${elementDef.type ?? 'unknown'})`
				)
			}

			return {
				element: elements[0],
				referencedVariableIds,
			}
		} catch (error) {
			this.#logger.error('Error evaluating element:', error)
			throw error
		}
	}
}

interface ElementStreamSession {
	readonly elementStreamId: string
	readonly controlId: string
	readonly elementId: string
	trackedExpressions: Set<string>

	latestResult: ElementStreamResult

	readonly changes: EventEmitter<{ change: [ElementStreamResult] }>
	isEvaluating: boolean
	hasPendingEvaluation: boolean
}
