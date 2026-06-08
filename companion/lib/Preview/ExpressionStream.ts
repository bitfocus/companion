import EventEmitter from 'node:events'
import type { JsonValue } from 'type-fest'
import z from 'zod'
import type {
	ExecuteExpressionResult,
	ExpressionStreamResult,
} from '@companion-app/shared/Expression/ExpressionResult.js'
import { ExpressionOrJsonValueSchema, type ExpressionOrValue } from '@companion-app/shared/Model/Options.js'
import { stringifyVariableValue, type VariableValues } from '@companion-app/shared/Model/Variables.js'
import { assertNever } from '@companion-app/shared/Util.js'
import type { ControlsController } from '../Controls/Controller.js'
import LogController from '../Log/Controller.js'
import { publicProcedure, router, toIterable } from '../UI/TRPC.js'
import type { LocalVariablesController } from '../Variables/LocalVariablesController.js'
import type { VariablesAndExpressionParser } from '../Variables/VariablesAndExpressionParser.js'

const contextResolutionSchema = z
	.discriminatedUnion('type', [
		z.object({
			type: z.literal('localVariable'),
			locationValue: ExpressionOrJsonValueSchema,
			nameValue: ExpressionOrJsonValueSchema,
		}),
		z.object({ type: z.literal('customVariable'), nameValue: ExpressionOrJsonValueSchema }),
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

	#resolveFieldToString(
		fieldValue: ExpressionOrValue<JsonValue | undefined>,
		parser: VariablesAndExpressionParser
	): { value: string | undefined; variableIds: ReadonlySet<string> } {
		try {
			const parsed = parser.parseEntityOption(fieldValue, { allowExpression: true, parseVariables: true })
			return {
				value: stringifyVariableValue(parsed.value) ?? undefined,
				variableIds: parsed.referencedVariableIds,
			}
		} catch {
			return { value: undefined, variableIds: new Set() }
		}
	}

	#resolveContextOverrides(
		contextResolution: ContextResolutionInput,
		session: ExpressionStreamSession
	): { overrides: VariableValues | null; extraVariableIds: ReadonlySet<string> } {
		const parser = this.#controlsController.createVariablesAndExpressionParser(null, null)

		if (contextResolution.type === 'localVariable') {
			const locationRes = this.#resolveFieldToString(contextResolution.locationValue, parser)
			const nameRes = this.#resolveFieldToString(contextResolution.nameValue, parser)
			const extraVariableIds = new Set<string>([...locationRes.variableIds, ...nameRes.variableIds])

			if (!locationRes.value || !nameRes.value) return { overrides: null, extraVariableIds }

			const localVariable = this.#localVariables.localVariableFor(locationRes.value, nameRes.value, {
				controlId: session.controlId || '',
				location: undefined,
			})
			if (!localVariable) return { overrides: null, extraVariableIds }

			// Store the target controlId so onVariablesChanged can trigger re-evaluation
			session.resolvedTargetControlId = localVariable.controlId

			return { overrides: this.#localVariables.getLocalVariableContextFor(localVariable), extraVariableIds }
		} else if (contextResolution.type === 'customVariable') {
			const nameRes = this.#resolveFieldToString(contextResolution.nameValue, parser)

			if (!nameRes.value) return { overrides: null, extraVariableIds: nameRes.variableIds }

			const customVariableId = `custom:${nameRes.value}`
			const extraVariableIds = new Set<string>([...nameRes.variableIds, customVariableId])

			// Read the current value of the custom variable (preserves numeric type)
			const valueResult = parser.executeExpression(`$(${customVariableId})`, undefined)
			return {
				overrides: { 'this:value': valueResult.ok ? valueResult.value : undefined },
				extraVariableIds,
			}
		} else {
			assertNever(contextResolution)
			return { overrides: null, extraVariableIds: new Set() }
		}
	}

	#withContextTracking = (
		result: ExecuteExpressionResult,
		extraVariableIds: ReadonlySet<string>
	): ExecuteExpressionResult => {
		if (extraVariableIds.size === 0) return result
		const variableIds = new Set(result.variableIds)
		for (const id of extraVariableIds) variableIds.add(id)
		return { ...result, variableIds }
	}

	#executeExpression = (session: ExpressionStreamSession): ExecuteExpressionResult => {
		let overrides: VariableValues | null = null
		let extraVariableIds: ReadonlySet<string> = new Set()

		if (session.contextResolution) {
			const resolved = this.#resolveContextOverrides(session.contextResolution, session)
			overrides = resolved.overrides
			extraVariableIds = resolved.extraVariableIds
		}

		const parser = this.#controlsController.createVariablesAndExpressionParser(session.controlId, overrides)

		// TODO - make reactive to control moving?
		return this.#withContextTracking(
			parser.executeExpression(session.expression, session.requiredType),
			extraVariableIds
		)
	}

	#parseVariables = (session: ExpressionStreamSession): ExecuteExpressionResult => {
		let overrides: VariableValues | null = null
		let extraVariableIds: ReadonlySet<string> = new Set()

		if (session.contextResolution) {
			const resolved = this.#resolveContextOverrides(session.contextResolution, session)
			overrides = resolved.overrides
			extraVariableIds = resolved.extraVariableIds
		}

		const parser = this.#controlsController.createVariablesAndExpressionParser(session.controlId, overrides)

		// TODO - make reactive to control moving?
		const res = parser.parseVariables(session.expression)
		return this.#withContextTracking({ ok: true, value: res.text, variableIds: res.variableIds }, extraVariableIds)
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
