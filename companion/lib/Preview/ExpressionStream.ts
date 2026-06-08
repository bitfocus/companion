import EventEmitter from 'node:events'
import z from 'zod'
import type {
	ExecuteExpressionResult,
	ExpressionStreamResult,
} from '@companion-app/shared/Expression/ExpressionResult.js'
import type { VariableValues } from '@companion-app/shared/Model/Variables.js'
import type { ControlsController } from '../Controls/Controller.js'
import LogController from '../Log/Controller.js'
import { publicProcedure, router, toIterable } from '../UI/TRPC.js'
import type { LocalVariablesController } from '../Variables/LocalVariablesController.js'

const contextResolutionSchema = z
	.discriminatedUnion('type', [
		z.object({ type: z.literal('localVariable'), location: z.string(), name: z.string() }),
		z.object({ type: z.literal('customVariable'), name: z.string() }),
	])
	.optional()

type ContextResolutionInput = NonNullable<z.infer<typeof contextResolutionSchema>>

export class PreviewExpressionStream {
	readonly #logger = LogController.createLogger('Variables/ExpressionStream')

	readonly #controlsController: ControlsController
	readonly #localVariables: LocalVariablesController

	readonly #sessions = new Map<string, ExpressionStreamSession>()

	constructor(controlsController: ControlsController, localVariables: LocalVariablesController) {
		this.#controlsController = controlsController
		this.#localVariables = localVariables
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
						contextResolution: contextResolutionSchema,
					})
				)
				.subscription(async function* ({ input, signal, ctx }) {
					const contextResolutionKey = input.contextResolution ? JSON.stringify(input.contextResolution) : ''
					const expressionId = `${input.controlId}::${input.expression}::${input.requiredType}::${input.isVariableString ? 'variable' : 'expression'}::${contextResolutionKey}`
					let session = self.#sessions.get(expressionId)

					try {
						if (!session) {
							self.#logger.debug(`Client "${ctx.clientId}" subscribed to new session: ${expressionId}`)

							session = {
								expressionId,
								controlId: input.controlId,
								expression: input.expression,
								requiredType: input.requiredType,
								isVariableString: input.isVariableString,
								contextResolution: input.contextResolution,
								resolvedTargetControlId: undefined,

								latestResult: { ok: true, value: undefined, variableIds: new Set() },
								changes: new EventEmitter(),
							}
							self.#sessions.set(expressionId, session)

							session.latestResult = input.isVariableString
								? self.#parseVariables(session)
								: self.#executeExpression(session)
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

	onVariablesChanged = (changed: ReadonlySet<string>, fromControlId: string | null): void => {
		for (const [expressionId, session] of this.#sessions) {
			// Always re-evaluate when the target control's local variables change
			const isTargetControlChange =
				fromControlId &&
				session.contextResolution?.type === 'localVariable' &&
				session.resolvedTargetControlId === fromControlId

			if (!isTargetControlChange) {
				if (fromControlId && session.controlId !== fromControlId) continue
				if (session.latestResult.variableIds.isDisjointFrom(changed)) continue
			}

			// There is some overlap (or target control changed), re-evaluate the expression
			// Future: this doesn't need to be done immediately, debounce it?

			this.#logger.debug(
				`Re-evaluating expression: ${expressionId} for ${session.changes.listenerCount('change')} clients`
			)

			const newValue = session.isVariableString ? this.#parseVariables(session) : this.#executeExpression(session)
			session.latestResult = newValue

			session.changes.emit('change', convertExpressionResult(newValue))
		}
	}

	#resolveContextOverrides(
		contextResolution: ContextResolutionInput,
		session: ExpressionStreamSession
	): VariableValues | null {
		if (contextResolution.type === 'localVariable') {
			if (!session.controlId) return null

			const localVariable = this.#localVariables.localVariableFor(contextResolution.location, contextResolution.name, {
				controlId: session.controlId,
				surfaceId: undefined,
				location: undefined,
				abortDelayed: new AbortController().signal,
				executionMode: 'sequential',
			})
			if (!localVariable) return null

			// Store the target controlId so onVariablesChanged can trigger re-evaluation
			session.resolvedTargetControlId = localVariable.controlId

			return this.#localVariables.getLocalVariableContextFor(localVariable)
		}

		if (contextResolution.type === 'customVariable') {
			// Use a generic parser to read the current custom variable value (preserves numeric type)
			const parser = this.#controlsController.createVariablesAndExpressionParser(null, null)
			const result = parser.executeExpression(`$(custom:${contextResolution.name})`, undefined)
			return { 'this:value': result.ok ? result.value : undefined }
		}

		return null
	}

	#executeExpression = (session: ExpressionStreamSession): ExecuteExpressionResult => {
		const overrides = session.contextResolution
			? this.#resolveContextOverrides(session.contextResolution, session)
			: null

		const parser = this.#controlsController.createVariablesAndExpressionParser(session.controlId, overrides)

		// TODO - make reactive to control moving?
		const result = parser.executeExpression(session.expression, session.requiredType)

		// Track the custom variable so onVariablesChanged re-evaluates when it changes
		if (session.contextResolution?.type === 'customVariable') {
			return {
				...result,
				variableIds: new Set([...result.variableIds, `custom:${session.contextResolution.name}`]),
			}
		}

		return result
	}

	#parseVariables = (session: ExpressionStreamSession): ExecuteExpressionResult => {
		const parser = this.#controlsController.createVariablesAndExpressionParser(session.controlId)

		// TODO - make reactive to control moving?
		const res = parser.parseVariables(session.expression)
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
	readonly contextResolution: ContextResolutionInput | undefined
	resolvedTargetControlId: string | undefined

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
