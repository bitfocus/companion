import type { ClientSocket, UIHandler } from '../UI/Handler.js'
import type { VariablesValues } from './Values.js'
import LogController from '../Log/Controller.js'
import type {
	ExecuteExpressionResult,
	ExpressionStreamResult,
} from '@companion-app/shared/Expression/ExpressionResult.js'
import { nanoid } from 'nanoid'
import type { PageController } from '../Page/Controller.js'

export class VariablesExpressionStream {
	readonly #logger = LogController.createLogger('Variables/ExpressionStream')

	// readonly #ioController: UIHandler
	readonly #pageController: PageController
	readonly #variablesController: VariablesValues

	readonly #sessions = new Map<string, ExpressionStreamSession>()

	constructor(_ioController: UIHandler, pageController: PageController, variablesController: VariablesValues) {
		// this.#ioController = ioController
		this.#pageController = pageController
		this.#variablesController = variablesController

		this.#variablesController.on('variables_changed', this.#onValuesChanged)
	}

	clientConnect(client: ClientSocket) {
		client.on('disconnect', () => {
			// Remove from all subscriptions
			for (const [expressionId, session] of this.#sessions) {
				for (const [fullSubId, subClient] of session.clients) {
					if (subClient === client) {
						session.clients.delete(fullSubId)

						this.#logger.debug(`Client "${client.id}" unsubscribed from session: ${expressionId}`)

						if (session.clients.size === 0) {
							this.#sessions.delete(expressionId)

							this.#logger.debug(`Session "${expressionId}" has no more clients, terminated`)
						}
					}
				}
			}
		})

		client.onPromise('variables:stream-expression:subscribe', (expression, controlId, requiredType) => {
			const subId = nanoid()
			const fullSubId = `${client.id}::${subId}`

			const expressionId = `${controlId}::${expression}::${requiredType}`
			const existingSession = this.#sessions.get(expressionId)
			if (existingSession) {
				// Add to the existing session
				existingSession.clients.set(fullSubId, client)

				this.#logger.debug(`Client "${client.id}" subscribed to existing session: ${expressionId}`)

				// Retrun the latest value
				return {
					subId,
					result: existingSession.latestResult,
				}
			}

			this.#logger.debug(`Client "${client.id}" subscribed to new session: ${expressionId}`)

			const initialValue = this.#executeExpression(expression, controlId, requiredType)
			const newSession: ExpressionStreamSession = {
				expressionId,
				controlId,
				expression,
				requiredType,

				latestResult: initialValue,
				clients: new Map([[fullSubId, client]]),
			}
			this.#sessions.set(expressionId, newSession)

			return { subId, result: convertExpressionResult(initialValue) }
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

					const notifiedClients = new Set<string>()

					const convertedValue = convertExpressionResult(newValue)
					for (const client of session.clients.values()) {
						// Ensure we only notify each client once
						if (notifiedClients.has(client.id)) continue
						notifiedClients.add(client.id)

						// TODO - maybe this should use rooms instead?
						client.emit('variables:stream-expression:update', session.expression, convertedValue)
					}

					break
				}
			}
		}
	}

	#executeExpression = (expression: string, controlId: string | null, requiredType: string | undefined) => {
		const location = controlId ? this.#pageController.getLocationOfControlId(controlId) : undefined

		// TODO - make reactive to control moving?
		return this.#variablesController.executeExpression(expression, location, requiredType, {}) // TODO local values?
	}
}

interface ExpressionStreamSession {
	readonly expressionId: string
	readonly controlId: string | null
	readonly expression: string
	readonly requiredType: string | undefined

	latestResult: ExecuteExpressionResult

	readonly clients: Map<string, ClientSocket>
}

function convertExpressionResult(result: ExecuteExpressionResult): ExpressionStreamResult {
	if (result.ok) {
		return { ok: true, value: result.value }
	} else {
		return { ok: false, error: result.error }
	}
}
