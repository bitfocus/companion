import LogController from '../Log/Controller.js'
import type {
	ExecuteExpressionResult,
	ExpressionStreamResult,
} from '@companion-app/shared/Expression/ExpressionResult.js'
import type { ControlsController } from '../Controls/Controller.js'
import { publicProcedure, router, toIterable } from '../UI/TRPC.js'
import z from 'zod'
import EventEmitter from 'node:events'

export class PreviewExpressionStream {
	readonly #logger = LogController.createLogger('Variables/ExpressionStream')

	readonly #controlsController: ControlsController

	readonly #sessions = new Map<string, ExpressionStreamSession>()

	constructor(controlsController: ControlsController) {
		this.#controlsController = controlsController
	}

	createTrpcRouter() {
		const self = this
		return router({
			watchExpression: publicProcedure
				.input(
					z.object({
						expression: z.string(),
						controlId: z.string().nullable(),
						requiredType: z.string().optional(),
						isVariableString: z.boolean(),
					})
				)
				.subscription(async function* ({ input, signal, ctx }) {
					const expressionId = `${input.controlId}::${input.expression}::${input.requiredType}::${input.isVariableString ? 'variable' : 'expression'}`
					let session = self.#sessions.get(expressionId)

					try {
						if (!session) {
							self.#logger.debug(`Client "${ctx.clientId}" subscribed to new session: ${expressionId}`)

							const initialValue = input.isVariableString
								? self.#parseVariables(input.expression, input.controlId)
								: self.#executeExpression(input.expression, input.controlId, input.requiredType)

							session = {
								expressionId,
								controlId: input.controlId,
								expression: input.expression,
								requiredType: input.requiredType,
								isVariableString: input.isVariableString,

								latestResult: initialValue,
								changes: new EventEmitter(),
							}
							self.#sessions.set(expressionId, session)
						} else {
							self.#logger.debug(`Client "${ctx.clientId}" subscribed to existing session: ${expressionId}`)
						}

						const changes = toIterable(session.changes, 'change', signal)

						yield convertExpressionResult(session.latestResult)

						for await (const [change] of changes) {
							yield change
						}
					} finally {
						self.#logger.debug(`Client "${ctx.clientId}" unsubscribed from session: ${expressionId}`)

						// Stop the session if no clients are left
						if (session && session.changes.listenerCount('change') === 0) {
							self.#sessions.delete(expressionId)

							self.#logger.debug(`Session "${expressionId}" has no more clients, terminated`)
						}
					}
				}),
		})
	}

	onVariablesChanged = (changed: Set<string>, fromControlId: string | null): void => {
		for (const [expressionId, session] of this.#sessions) {
			if (fromControlId && session.controlId !== fromControlId) continue

			for (const variableId of changed) {
				if (session.latestResult.variableIds.has(variableId)) {
					// There is some overlap, re-evaluate the expression
					// Future: this doesn't need to be done immediately, debounce it?

					this.#logger.silly(
						`Re-evaluating expression: ${expressionId} for ${session.changes.listenerCount('change')} clients`
					)

					const newValue = this.#executeExpression(session.expression, session.controlId, session.requiredType)
					session.latestResult = newValue

					session.changes.emit('change', convertExpressionResult(newValue))

					break
				}
			}
		}
	}

	#executeExpression = (
		expression: string,
		controlId: string | null,
		requiredType: string | undefined
	): ExecuteExpressionResult => {
		const parser = this.#controlsController.createVariablesAndExpressionParser(controlId, null)

		// TODO - make reactive to control moving?
		return parser.executeExpression(expression, requiredType)
	}

	#parseVariables = (str: string, controlId: string | null): ExecuteExpressionResult => {
		const parser = this.#controlsController.createVariablesAndExpressionParser(controlId, null)

		// TODO - make reactive to control moving?
		const res = parser.parseVariables(str)
		return {
			ok: true,
			value: res.text,
			variableIds: res.variableIds,
		}
	}
}

interface ExpressionStreamSession {
	readonly expressionId: string
	readonly controlId: string | null
	readonly expression: string
	readonly requiredType: string | undefined
	readonly isVariableString: boolean

	latestResult: ExecuteExpressionResult

	readonly changes: EventEmitter<{ change: [ExpressionStreamResult] }>
}

function convertExpressionResult(result: ExecuteExpressionResult): ExpressionStreamResult {
	if (result.ok) {
		return { ok: true, value: result.value }
	} else {
		return { ok: false, error: result.error }
	}
}
