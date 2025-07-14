import { cloneDeep } from 'lodash-es'
import { nanoid } from 'nanoid'
import jsonPatch from 'fast-json-patch'
import { clamp } from '../Resources/Util.js'
import LogController from '../Log/Controller.js'
import { EventEmitter } from 'events'
import type { Registry } from '../Registry.js'
import type {
	RecordActionEntityModel,
	RecordSessionInfo,
	RecordSessionListInfo,
	RecordSessionUpdate,
} from '@companion-app/shared/Model/ActionRecorderModel.js'
import type { ActionSetId } from '@companion-app/shared/Model/ActionModel.js'
import { EntityModelType, SomeSocketEntityLocation } from '@companion-app/shared/Model/EntityModel.js'
import { publicProcedure, router, toIterable } from '../UI/TRPC.js'
import z from 'zod'

export interface ActionRecorderEvents {
	sessions_changed: [sessionIds: string[]]
	action_recorder_is_running: [boolean]
}

/**
 * Class to handle recording of actions onto a control.
 *
 * Note: This code has been written to be halfway to supporting multiple concurrent recording sessions.
 * In places where it doesnt add any/much complexity, to make it more futureproof.
 *
 * @author Håkon Nessjøen <haakon@bitfocus.io>
 * @author Keith Rocheck <keith.rocheck@gmail.com>
 * @author William Viker <william@bitfocus.io>
 * @author Julian Waller <me@julusian.co.uk>
 * @since 3.0.0
 * @copyright 2022 Bitfocus AS
 * @license
 * This program is free software.
 * You should have received a copy of the MIT licence as well as the Bitfocus
 * Individual Contributor License Agreement for Companion along with
 * this program.
 */
export class ActionRecorder extends EventEmitter<ActionRecorderEvents> {
	readonly #logger = LogController.createLogger('Control/ActionRecorder')

	readonly #registry: Pick<Registry, 'instance' | 'controls'>

	/**
	 * The connection ids which are currently informed to be recording
	 * Note: this may contain some ids which are not,
	 */
	#currentlyRecordingConnectionIds = new Set<string>()

	/**
	 * Data from the current recording session
	 */
	#currentSession: RecordSessionInfo

	/**
	 * The last sent info json object
	 */
	#lastSentSessionListJson: Record<string, RecordSessionListInfo> = {}

	/**
	 * The last sent info json object
	 */
	#lastSentSessionInfoJsons: Record<string, RecordSessionInfo> = {}

	constructor(registry: Registry) {
		super()

		this.#registry = registry

		// create the 'default' session
		this.#currentSession = {
			id: nanoid(),
			connectionIds: [],
			isRunning: false,
			actions: [],
		}

		this.commitChanges([this.#currentSession.id])
	}

	readonly #updateEvents = new EventEmitter<{
		[patch: `patchSession:${string}`]: [update: RecordSessionUpdate]
	}>()

	createTrpcRouter() {
		const self = this
		const selfEmitter: EventEmitter<ActionRecorderEvents> = this
		return router({
			sessionList: publicProcedure.subscription<AsyncIterable<Record<string, RecordSessionListInfo>>>(
				async function* (opts) {
					// Send initial data
					yield self.#lastSentSessionListJson

					// Listen for changes
					const changes = toIterable(selfEmitter, 'sessions_changed', opts.signal)
					for await (const [_sessionIds] of changes) {
						yield self.#lastSentSessionListJson
					}
				}
			),

			// Future: for now we require there to always be exactly one session
			// client.onPromise('action-recorder:create', (instanceIds0) => {
			// 	if (this.#currentSession) throw new Error('Already active')

			// 	if (!Array.isArray(instanceIds0)) throw new Error('Expected array of instance ids')
			// 	const allValidIds = new Set(this.instance.getAllInstanceIds())
			// 	const instanceIds = instanceIds0.filter((id) => allValidIds.has(id))
			// 	if (instanceIds.length === 0) throw new Error('No instance ids provided')

			// 	const id = nanoid()
			// 	this.#currentSession = {
			// 		id,
			// 		instanceIds,
			// 		isRunning: false,
			// 		actions: [],
			// 	}

			// 	// Broadcast changes
			// 	this.commitChanges(id)

			// 	return id
			// })

			session: router({
				abort: publicProcedure.input(z.object({ sessionId: z.string() })).mutation(async ({ input }) => {
					if (!this.#currentSession || this.#currentSession.id !== input.sessionId)
						throw new Error(`Invalid session: ${input.sessionId}`)

					this.destroySession()
				}),

				discardActions: publicProcedure.input(z.object({ sessionId: z.string() })).mutation(async ({ input }) => {
					if (!this.#currentSession || this.#currentSession.id !== input.sessionId)
						throw new Error(`Invalid session: ${input.sessionId}`)

					this.discardActions()
				}),

				setRecording: publicProcedure
					.input(z.object({ sessionId: z.string(), isRunning: z.boolean() }))
					.mutation(async ({ input }) => {
						if (!this.#currentSession || this.#currentSession.id !== input.sessionId)
							throw new Error(`Invalid session: ${input.sessionId}`)

						this.setRecording(input.isRunning)
					}),

				setConnections: publicProcedure
					.input(z.object({ sessionId: z.string(), connectionIds: z.array(z.string()) }))
					.mutation(async ({ input }) => {
						if (!this.#currentSession || this.#currentSession.id !== input.sessionId)
							throw new Error(`Invalid session: ${input.sessionId}`)

						this.setSelectedConnectionIds(input.connectionIds)
					}),

				/**
				 * Watch for session changes
				 */
				watch: publicProcedure.input(z.object({ sessionId: z.string() })).subscription(async function* (opts) {
					if (!self.#currentSession || self.#currentSession.id !== opts.input.sessionId)
						throw new Error(`Invalid session: ${opts.input.sessionId}`)

					const changes = toIterable(self.#updateEvents, `patchSession:${opts.input.sessionId}`, opts.signal)

					// Send initial session data
					const sessionInfo = self.#lastSentSessionInfoJsons[opts.input.sessionId]
					if (sessionInfo) {
						yield {
							type: 'init',
							session: sessionInfo,
						} satisfies RecordSessionUpdate
					}

					// Listen for changes
					for await (const [change] of changes) {
						yield change
					}
				}),

				action: router({
					delete: publicProcedure
						.input(z.object({ sessionId: z.string(), actionId: z.string() }))
						.mutation(async ({ input }) => {
							if (!this.#currentSession || this.#currentSession.id !== input.sessionId)
								throw new Error(`Invalid session: ${input.sessionId}`)

							// Filter out the action
							this.#currentSession.actions = this.#currentSession.actions.filter((a) => a.id !== input.actionId)

							this.commitChanges([input.sessionId])
						}),

					duplicate: publicProcedure
						.input(z.object({ sessionId: z.string(), actionId: z.string() }))
						.mutation(async ({ input }) => {
							if (!this.#currentSession || this.#currentSession.id !== input.sessionId)
								throw new Error(`Invalid session: ${input.sessionId}`)

							// Filter out the action
							const index = this.#currentSession.actions.findIndex((a) => a.id === input.actionId)
							if (index !== -1) {
								const newAction = cloneDeep(this.#currentSession.actions[index])
								newAction.id = nanoid()
								this.#currentSession.actions.splice(index + 1, 0, newAction)

								this.commitChanges([input.sessionId])
							}
						}),

					setValue: publicProcedure
						.input(z.object({ sessionId: z.string(), actionId: z.string(), key: z.string(), value: z.any() }))
						.mutation(async ({ input }) => {
							if (!this.#currentSession || this.#currentSession.id !== input.sessionId)
								throw new Error(`Invalid session: ${input.sessionId}`)

							// Find and update the action
							const index = this.#currentSession.actions.findIndex((a) => a.id === input.actionId)
							if (index !== -1) {
								const action = this.#currentSession.actions[index]

								if (!action.options) action.options = {}
								action.options[input.key] = input.value

								this.commitChanges([input.sessionId])
							}
						}),

					reorder: publicProcedure
						.input(z.object({ sessionId: z.string(), actionId: z.string(), newIndex: z.number() }))
						.mutation(async ({ input }) => {
							if (!this.#currentSession || this.#currentSession.id !== input.sessionId)
								throw new Error(`Invalid session: ${input.sessionId}`)

							const oldIndex = this.#currentSession.actions.findIndex((a) => a.id === input.actionId)
							if (oldIndex === -1) throw new Error(`Invalid action: ${input.actionId}`)

							const newIndex = clamp(input.newIndex, 0, this.#currentSession.actions.length)
							this.#currentSession.actions.splice(newIndex, 0, ...this.#currentSession.actions.splice(oldIndex, 1))

							this.commitChanges([input.sessionId])
						}),
				}),

				saveToControl: publicProcedure
					.input(
						z.object({
							sessionId: z.string(),
							controlId: z.string(),
							stepId: z.string(),
							setId: z.union([z.enum(['down', 'up', 'rotate_left', 'rotate_right']), z.number()]),
							mode: z.enum(['replace', 'append']),
						})
					)
					.mutation(async ({ input }) => {
						if (!this.#currentSession || this.#currentSession.id !== input.sessionId)
							throw new Error(`Invalid session: ${input.sessionId}`)

						this.saveToControlId(input.controlId, input.stepId, input.setId, input.mode)
					}),
			}),
		})
	}

	/**
	 * Commit any changes to interested clients.
	 * Informs all clients about the 'list' of sessions, and any interested clients about specified sessions
	 * @param sessionIds any sessions that have changed and should be diffed
	 */
	private commitChanges(sessionIds: string[]) {
		if (sessionIds && Array.isArray(sessionIds)) {
			for (const sessionId of sessionIds) {
				const sessionInfo = this.#currentSession && this.#currentSession.id === sessionId ? this.#currentSession : null

				const newSessionBlob = sessionInfo ? cloneDeep(sessionInfo) : null

				const eventName = `patchSession:${sessionId}` as const

				if (this.#updateEvents.listenerCount(eventName) > 0) {
					if (this.#lastSentSessionInfoJsons[sessionId] && newSessionBlob) {
						const patch = jsonPatch.compare<RecordSessionInfo>(
							this.#lastSentSessionInfoJsons[sessionId],
							newSessionBlob
						)
						if (patch.length > 0) {
							this.#updateEvents.emit(eventName, {
								type: 'patch',
								patch,
							})
						}
					} else if (newSessionBlob) {
						// Send initial session info
						this.#updateEvents.emit(eventName, {
							type: 'init',
							session: newSessionBlob,
						})
					} else if (this.#lastSentSessionInfoJsons[sessionId]) {
						// Send removal of session info
						this.#updateEvents.emit(eventName, {
							type: 'remove',
						})
					} else {
						// Nothing to do
					}
				}

				if (newSessionBlob) {
					this.#lastSentSessionInfoJsons[sessionId] = newSessionBlob
				} else {
					delete this.#lastSentSessionInfoJsons[sessionId]
				}
			}
		}

		const newSessionListJson: Record<string, RecordSessionListInfo> = {}

		if (this.#currentSession) {
			newSessionListJson[this.#currentSession.id] = {
				connectionIds: cloneDeep(this.#currentSession.connectionIds),
			}
		}

		this.#lastSentSessionListJson = newSessionListJson

		this.emit('sessions_changed', sessionIds)
	}

	/**
	 * Destroy the recorder session, and create a fresh one
	 * Note: this discards any actions that havent yet been added to a control
	 */
	destroySession(preserveConnections?: boolean): void {
		const oldSession = this.#currentSession

		this.#currentSession.isRunning = false
		this.emit('action_recorder_is_running', this.#currentSession.isRunning)
		this.#syncRecording()

		const newId = nanoid()
		this.#currentSession = {
			id: newId,
			connectionIds: [],
			isRunning: false,
			actions: [],
		}

		if (preserveConnections) {
			this.#currentSession.connectionIds.push(...oldSession.connectionIds)
		}

		this.commitChanges([oldSession.id, newId])
	}

	/**
	 * Discard all the actions currently held in the recording session
	 */
	discardActions(): void {
		this.#currentSession.actions = []

		this.commitChanges([this.#currentSession.id])
	}

	getSession(): RecordSessionInfo {
		return this.#currentSession
	}

	/**
	 * An connection has just started/stopped, make sure it is aware if it should be recording
	 * @param connectionId
	 * @param running Whether it is now running
	 */
	connectionAvailabilityChange(connectionId: string, running: boolean): void {
		if (!running) {
			if (this.#currentSession) {
				// Remove the connection which has stopped
				const newIds = this.#currentSession.connectionIds.filter((id) => id !== connectionId)

				if (newIds.length !== this.#currentSession.connectionIds.length) {
					this.commitChanges([this.#currentSession.id])
				}
			}
		}
	}

	/**
	 * Add an action received from a connection to the session
	 */
	receiveAction(
		connectionId: string,
		actionId: string,
		options: Record<string, any>,
		delay: number,
		uniquenessId: string | undefined
	): void {
		const changedSessionIds = []

		if (this.#currentSession) {
			const session = this.#currentSession

			if (session.connectionIds.includes(connectionId)) {
				const newAction: RecordActionEntityModel = {
					type: EntityModelType.Action,
					id: nanoid(),
					connectionId: connectionId,
					definitionId: actionId,
					options: options,

					uniquenessId,
				}
				const delayAction: RecordActionEntityModel = {
					type: EntityModelType.Action,
					id: nanoid(),
					connectionId: 'internal',
					definitionId: 'wait',
					options: {
						time: delay,
					},
					uniquenessId: undefined,
				}

				// Replace existing action with matching uniquenessId, or push to end of the list
				const uniquenessIdIndex = session.actions.findIndex(
					(act) => act.uniquenessId && act.uniquenessId === uniquenessId
				)
				if (uniquenessIdIndex !== -1) {
					session.actions[uniquenessIdIndex] = newAction

					// Update or push the delay before the current one
					const oldPrevAction = session.actions[uniquenessIdIndex - 1]
					if (
						oldPrevAction &&
						oldPrevAction.connectionId === delayAction.connectionId &&
						oldPrevAction.definitionId === delayAction.definitionId
					) {
						session.actions[uniquenessIdIndex - 1] = delayAction
					} else if (delay > 0) {
						session.actions.splice(uniquenessIdIndex, 0, delayAction)
					}
				} else {
					if (delay > 0) session.actions.push(delayAction)
					session.actions.push(newAction)
				}

				changedSessionIds.push(session.id)
			}
		}

		if (changedSessionIds.length > 0) {
			this.commitChanges(changedSessionIds)
		}
	}

	/**
	 * Save the recorded actions to a control
	 */
	saveToControlId(controlId: string, stepId: string, setId: ActionSetId, mode: 'replace' | 'append'): void {
		if (mode !== 'replace' && mode !== 'append') throw new Error(`Invalid mode: ${mode}`)

		const control = this.#registry.controls.getControl(controlId)
		if (!control) throw new Error(`Unknown control: ${controlId}`)

		if (mode === 'append') {
			if (control.supportsEntities) {
				if (!control.entities.entityAdd({ stepId, setId }, null, ...this.#currentSession.actions))
					throw new Error('Unknown set')
			} else {
				throw new Error('Not supported by control')
			}
		} else {
			if (control.supportsEntities) {
				const listId: SomeSocketEntityLocation = { stepId, setId }
				if (!control.entities.entityReplaceAll(listId, this.#currentSession.actions)) throw new Error('Unknown set')
			} else {
				throw new Error('Not supported by control')
			}
		}

		this.destroySession(true)
	}

	/**
	 * Set the current session as recording
	 */
	setRecording(isRunning: boolean): void {
		this.#currentSession.isRunning = !!isRunning
		this.emit('action_recorder_is_running', this.#currentSession.isRunning)
		this.#syncRecording()

		this.commitChanges([this.#currentSession.id])
	}

	/**
	 * Set the current connections being recorded from
	 */
	setSelectedConnectionIds(connectionIds0: string[]): void {
		if (!Array.isArray(connectionIds0)) throw new Error('Expected array of connection ids')
		const allValidIds = new Set(this.#registry.instance.getAllInstanceIds())
		const connectionIds = connectionIds0.filter((id) => allValidIds.has(id))

		this.#currentSession.connectionIds = connectionIds
		this.#syncRecording()

		this.commitChanges([this.#currentSession.id])
	}

	/**
	 * Sync the correct recording status to each connection
	 * @access private
	 */
	#syncRecording(): void {
		const ps: Promise<any>[] = []

		const targetRecordingConnectionIds = new Set<string>()
		if (this.#currentSession && this.#currentSession.isRunning) {
			for (const id of this.#currentSession.connectionIds) {
				targetRecordingConnectionIds.add(id)
			}
		}

		// Find ones to start recording
		for (const connectionId of targetRecordingConnectionIds.values()) {
			// Future: skip checking if they already know, to make sure they dont get stuck
			const connection = this.#registry.instance.moduleHost.getChild(connectionId)
			if (connection) {
				ps.push(
					connection.startStopRecordingActions(true).catch((e) => {
						this.#logger.warn(`Failed to start recording for "${connectionId}": ${e}`)
					})
				)
			}
		}

		// Find ones to stop recording
		for (const connectionId of this.#currentlyRecordingConnectionIds.values()) {
			if (!targetRecordingConnectionIds.has(connectionId)) {
				const connection = this.#registry.instance.moduleHost.getChild(connectionId)
				if (connection) {
					ps.push(
						connection.startStopRecordingActions(false).catch((e) => {
							this.#logger.warn(`Failed to stop recording for "${connectionId}": ${e}`)
						})
					)
				}
			}
		}

		this.#currentlyRecordingConnectionIds = targetRecordingConnectionIds

		// Wait for them all to be synced
		Promise.all(ps).catch((e) => {
			this.#logger.error(`Failed to syncRecording: ${e}`)
		})
	}
}
