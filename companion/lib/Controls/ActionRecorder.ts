import { cloneDeep } from 'lodash-es'
import { nanoid } from 'nanoid'
import jsonPatch from 'fast-json-patch'
import { clamp } from '../Resources/Util.js'
import LogController from '../Log/Controller.js'
import { EventEmitter } from 'events'
import type { Registry } from '../Registry.js'
import type {
	RecordActionTmp,
	RecordSessionInfo,
	RecordSessionListInfo,
} from '@companion-app/shared/Model/ActionRecorderModel.js'
import type { ClientSocket } from '../UI/Handler.js'
import type { ActionSetId } from '@companion-app/shared/Model/ActionModel.js'

const SessionListRoom = 'action-recorder:session-list'
function SessionRoom(id: string): string {
	return `action-recorder:session:${id}`
}

interface ActionRecorderEvents {
	sessions_changed: [sessionIds: string[]]
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
 *
 * You can be released from the requirements of the license by purchasing
 * a commercial license. Buying such a license is mandatory as soon as you
 * develop commercial activities involving the Companion software without
 * disclosing the source code of your own applications.
 */
export class ActionRecorder extends EventEmitter<ActionRecorderEvents> {
	readonly #logger = LogController.createLogger('Control/ActionRecorder')

	readonly #registry: Registry

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

	/**
	 * Setup a new socket client's events
	 */
	clientConnect(client: ClientSocket): void {
		client.onPromise('action-recorder:subscribe', () => {
			client.join(SessionListRoom)

			return this.#lastSentSessionListJson
		})
		client.onPromise('action-recorder:unsubscribe', () => {
			client.leave(SessionListRoom)
		})

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
		client.onPromise('action-recorder:session:abort', (sessionId) => {
			if (!this.#currentSession || this.#currentSession.id !== sessionId)
				throw new Error(`Invalid session: ${sessionId}`)

			this.destroySession()
		})
		client.onPromise('action-recorder:session:discard-actions', (sessionId) => {
			if (!this.#currentSession || this.#currentSession.id !== sessionId)
				throw new Error(`Invalid session: ${sessionId}`)

			this.discardActions()
		})
		client.onPromise('action-recorder:session:recording', (sessionId, isRunning) => {
			if (!this.#currentSession || this.#currentSession.id !== sessionId)
				throw new Error(`Invalid session: ${sessionId}`)

			this.setRecording(isRunning)
		})
		client.onPromise('action-recorder:session:set-connections', (sessionId, connectionIds) => {
			if (!this.#currentSession || this.#currentSession.id !== sessionId)
				throw new Error(`Invalid session: ${sessionId}`)

			this.setSelectedConnectionIds(connectionIds)
		})

		client.onPromise('action-recorder:session:subscribe', (sessionId) => {
			if (!this.#currentSession || this.#currentSession.id !== sessionId)
				throw new Error(`Invalid session: ${sessionId}`)

			client.join(SessionRoom(sessionId))

			return this.#lastSentSessionInfoJsons[sessionId]
		})
		client.onPromise('action-recorder:session:unsubscribe', (sessionId) => {
			client.leave(SessionRoom(sessionId))
		})

		client.onPromise('action-recorder:session:action-delete', (sessionId, actionId) => {
			if (!this.#currentSession || this.#currentSession.id !== sessionId)
				throw new Error(`Invalid session: ${sessionId}`)

			// Filter out the action
			this.#currentSession.actions = this.#currentSession.actions.filter((a) => a.id !== actionId)

			this.commitChanges([sessionId])
		})
		client.onPromise('action-recorder:session:action-duplicate', (sessionId, actionId) => {
			if (!this.#currentSession || this.#currentSession.id !== sessionId)
				throw new Error(`Invalid session: ${sessionId}`)

			// Filter out the action
			const index = this.#currentSession.actions.findIndex((a) => a.id === actionId)
			if (index !== -1) {
				const newAction = cloneDeep(this.#currentSession.actions[index])
				newAction.id = nanoid()
				this.#currentSession.actions.splice(index + 1, 0, newAction)

				this.commitChanges([sessionId])
			}
		})
		client.onPromise('action-recorder:session:action-set-value', (sessionId, actionId, key, value) => {
			if (!this.#currentSession || this.#currentSession.id !== sessionId)
				throw new Error(`Invalid session: ${sessionId}`)

			// Find and update the action
			const index = this.#currentSession.actions.findIndex((a) => a.id === actionId)
			if (index !== -1) {
				const action = this.#currentSession.actions[index]

				if (!action.options) action.options = {}
				action.options[key] = value

				this.commitChanges([sessionId])
			}
		})
		client.onPromise('action-recorder:session:action-reorder', (sessionId, actionId, newIndex) => {
			if (!this.#currentSession || this.#currentSession.id !== sessionId)
				throw new Error(`Invalid session: ${sessionId}`)

			const oldIndex = this.#currentSession.actions.findIndex((a) => a.id === actionId)
			if (oldIndex === -1) throw new Error(`Invalid action: ${actionId}`)

			newIndex = clamp(newIndex, 0, this.#currentSession.actions.length)
			this.#currentSession.actions.splice(newIndex, 0, ...this.#currentSession.actions.splice(oldIndex, 1))

			this.commitChanges([sessionId])
		})
		client.onPromise('action-recorder:session:save-to-control', (sessionId, controlId, stepId, setId, mode) => {
			if (!this.#currentSession || this.#currentSession.id !== sessionId)
				throw new Error(`Invalid session: ${sessionId}`)

			this.saveToControlId(controlId, stepId, setId, mode)
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

				const room = SessionRoom(sessionId)
				if (this.#registry.io.countRoomMembers(room) > 0) {
					const patch = jsonPatch.compare(this.#lastSentSessionInfoJsons[sessionId] || {}, newSessionBlob || {})
					if (patch.length > 0) {
						this.#registry.io.emitToRoom(room, `action-recorder:session:update:${sessionId}`, patch)
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

		if (this.#registry.io.countRoomMembers(SessionListRoom) > 0) {
			const patch = jsonPatch.compare(this.#lastSentSessionListJson, newSessionListJson || {})
			if (patch.length > 0) {
				this.#registry.io.emitToRoom(SessionListRoom, `action-recorder:session-list`, patch)
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
	 * An conncetion has just started/stopped, make sure it is aware if it should be recording
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
				const newAction: RecordActionTmp = {
					id: nanoid(),
					instance: connectionId,
					action: actionId,
					options: options,

					uniquenessId,
				}
				const delayAction: RecordActionTmp = {
					id: nanoid(),
					instance: 'internal',
					action: 'wait',
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
					if (oldPrevAction.instance === delayAction.instance && oldPrevAction.action === delayAction.action) {
						session.actions[uniquenessIdIndex - 1] = delayAction
					} else {
						session.actions.splice(uniquenessIdIndex - 1, 0, delayAction)
					}
				} else {
					session.actions.push(delayAction, newAction)
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
			if (control.supportsActions) {
				if (!control.actionAppend(stepId, setId, this.#currentSession.actions, null)) throw new Error('Unknown set')
			} else {
				throw new Error('Not supported by control')
			}
		} else {
			if (control.supportsActions) {
				if (!control.actionReplaceAll(stepId, setId, this.#currentSession.actions)) throw new Error('Unknown set')
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
