import type { ClientSocket, UIHandler } from '../UI/Handler.js'
import type { VariablesValues } from './Values.js'
import LogController from '../Log/Controller.js'
import type {
	ExecuteExpressionResult,
	ExpressionStreamResult,
} from '@companion-app/shared/Expression/ExpressionResult.js'

export class VariablesExpressionStream {
	readonly #logger = LogController.createLogger('Variables/ExpressionStream')

	// readonly #ioController: UIHandler
	readonly #variablesController: VariablesValues

	readonly #sessions = new Map<string, ExpressionStreamSession>()

	constructor(_ioController: UIHandler, variablesController: VariablesValues) {
		// this.#ioController = ioController
		this.#variablesController = variablesController

		this.#variablesController.on('variables_changed', this.#onValuesChanged)
	}

	clientConnect(client: ClientSocket) {
		client.onPromise('variables:stream-expression:subscribe', (subId, controlId, expression, requiredType) => {
			if (!subId || typeof expression !== 'string') throw new Error('Invalid subId')

			const fullSubId = `${client.id}::${subId}`

			const expressionId = `${controlId}::${expression}::${requiredType}`
			const existingSession = this.#sessions.get(expressionId)
			if (existingSession) {
				// Add to the existing session
				existingSession.clients.set(fullSubId, { subId, client })

				this.#logger.debug(`Client "${client.id}" subscribed to existing session: ${expressionId}`)

				// Retrun the latest value
				return existingSession.latestResult
			}

			this.#logger.debug(`Client "${client.id}" subscribed to new session: ${expressionId}`)

			const initialValue = this.#executeExpression(expression, controlId, requiredType)
			const newSession: ExpressionStreamSession = {
				expressionId,
				controlId,
				expression,
				requiredType,

				latestResult: initialValue,
				clients: new Map([[fullSubId, { subId, client }]]),
			}
			this.#sessions.set(expressionId, newSession)

			return convertExpressionResult(initialValue)
		})

		client.onPromise('variables:stream-expression:unsubscribe', (subId) => {
			if (!subId) throw new Error('Invalid')

			const fullSubId = `${client.id}::${subId}`

			// TODO - can this find the correct session better?

			for (const [expressionId, session] of this.#sessions) {
				if (session.clients.has(fullSubId)) {
					session.clients.delete(fullSubId)

					this.#logger.debug(`Client "${client.id}" unsubscribed from session: ${expressionId}`)

					if (session.clients.size === 0) {
						this.#sessions.delete(expressionId)

						this.#logger.debug(`Session "${expressionId}" has no more clients, terminated`)
					}

					return
				}
			}
		})
	}

	#onValuesChanged = (changed: Set<string>) => {
		for (const [expressionId, session] of this.#sessions) {
			for (const variableId of changed) {
				if (session.latestResult.variableIds.has(variableId)) {
					// There is some overlap, re-evaluate the expression
					// Future: this doesn't need to be done immediately, debounce it?

					this.#logger.debug(`Re-evaluating expression: ${expressionId} for ${session.clients.size} clients`)

					const newValue = this.#executeExpression(session.expression, session.controlId, session.requiredType)
					session.latestResult = newValue

					const convertedValue = convertExpressionResult(newValue)
					for (const { subId, client } of session.clients.values()) {
						client.emit('variables:stream-expression:update', subId, convertedValue)
					}

					break
				}
			}
		}
	}

	#executeExpression = (expression: string, _controlId: string | null, requiredType: string | undefined) => {
		// TODO - use the correct location/variables
		return this.#variablesController.executeExpression(expression, undefined, requiredType, {}) // TODO properly
	}
}

interface ExpressionStreamSession {
	readonly expressionId: string
	readonly controlId: string | null
	readonly expression: string
	readonly requiredType: string | undefined

	latestResult: ExecuteExpressionResult

	readonly clients: Map<string, { subId: string; client: ClientSocket }>
}

function convertExpressionResult(result: ExecuteExpressionResult): ExpressionStreamResult {
	if (result.ok) {
		return { ok: true, value: result.value }
	} else {
		return { ok: false, error: result.error }
	}
}
