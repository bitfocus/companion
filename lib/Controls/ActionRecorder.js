import { cloneDeep } from 'lodash-es'
import { nanoid } from 'nanoid'
import jsonPatch from 'fast-json-patch'
import { clamp } from '../Resources/Util.js'
import LogController from '../Log/Controller.js'
import { EventEmitter } from 'events'

const SessionListRoom = 'action-recorder:session-list'
/**
 * @param {string} id
 * @returns {string}
 */
function SessionRoom(id) {
	return `action-recorder:session:${id}`
}

/**
 * @typedef {import('../Shared/Model/ActionRecorderModel.js').RecordSessionInfo} RecordSessionInfo
 * @typedef {import('../Shared/Model/ActionRecorderModel.js').RecordSessionListInfo} RecordSessionListInfo
 * @typedef {import('../Shared/Model/ActionRecorderModel.js').RecordActionTmp} RecordActionTmp
 */

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
export default class ActionRecorder extends EventEmitter {
	#logger = LogController.createLogger('Control/ActionRecorder')

	/**
	 * @access private
	 * @type {import('../Registry.js').default}
	 * @readonly
	 */
	#registry

	/**
	 * The connection ids which are currently informed to be recording
	 * Note: this may contain some ids which are not,
	 * @type {Set<string>}
	 * @access private
	 */
	#currentlyRecordingConnectionIds = new Set()

	/**
	 * Data from the current recording session
	 * @type {RecordSessionInfo}
	 * @access private
	 */
	#currentSession

	/**
	 * The last sent info json object
	 * @type {Record<string, RecordSessionListInfo> | null}
	 * @access private
	 */
	#lastSentSessionListJson = null

	/**
	 * The last sent info json object
	 * @type {Record<string, RecordSessionInfo>}
	 * @access private
	 */
	#lastSentSessionInfoJsons = {}

	/**
	 * @param {import('../Registry.js').default} registry
	 */
	constructor(registry) {
		super()

		this.#registry = registry

		// create the 'default' session
		this.#currentSession = {
			id: nanoid(),
			connectionIds: [],
			isRunning: false,
			actionDelay: 0,
			actions: [],
		}

		this.commitChanges([this.#currentSession.id])
	}

	/**
	 * Setup a new socket client's events
	 * @param {import('../UI/Handler.js').ClientSocket} client - the client socket
	 * @access public
	 */
	clientConnect(client) {
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
		// 		actionDelay: 0,
		// 		actions: [],
		// 	}

		// 	// Broadcast changes
		// 	this.commitChanges(id)

		// 	return id
		// })
		client.onPromise('action-recorder:session:abort', (/** @type {string} */ sessionId) => {
			if (!this.#currentSession || this.#currentSession.id !== sessionId)
				throw new Error(`Invalid session: ${sessionId}`)

			this.destroySession()

			return true
		})
		client.onPromise('action-recorder:session:discard-actions', (/** @type {string} */ sessionId) => {
			if (!this.#currentSession || this.#currentSession.id !== sessionId)
				throw new Error(`Invalid session: ${sessionId}`)

			this.discardActions()

			return true
		})
		client.onPromise(
			'action-recorder:session:recording',
			(/** @type {string} */ sessionId, /** @type {boolean} */ isRunning) => {
				if (!this.#currentSession || this.#currentSession.id !== sessionId)
					throw new Error(`Invalid session: ${sessionId}`)

				this.setRecording(isRunning)

				return true
			}
		)
		client.onPromise(
			'action-recorder:session:set-connections',
			(/** @type {string} */ sessionId, /** @type {string[]} */ connectionIds) => {
				if (!this.#currentSession || this.#currentSession.id !== sessionId)
					throw new Error(`Invalid session: ${sessionId}`)

				this.setSelectedConnectionIds(connectionIds)

				return true
			}
		)

		client.onPromise('action-recorder:session:subscribe', (/** @type {string} */ sessionId) => {
			if (!this.#currentSession || this.#currentSession.id !== sessionId)
				throw new Error(`Invalid session: ${sessionId}`)

			client.join(SessionRoom(sessionId))

			return this.#lastSentSessionInfoJsons[sessionId]
		})
		client.onPromise('action-recorder:session:unsubscribe', (/** @type {any} */ sessionId) => {
			client.leave(SessionRoom(sessionId))
		})

		client.onPromise(
			'action-recorder:session:action-delete',
			(/** @type {string} */ sessionId, /** @type {string} */ actionId) => {
				if (!this.#currentSession || this.#currentSession.id !== sessionId)
					throw new Error(`Invalid session: ${sessionId}`)

				// Filter out the action
				this.#currentSession.actions = this.#currentSession.actions.filter((a) => a.id !== actionId)

				this.commitChanges([sessionId])
			}
		)
		client.onPromise(
			'action-recorder:session:action-duplicate',
			(/** @type {string} */ sessionId, /** @type {string} */ actionId) => {
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
			}
		)
		client.onPromise(
			'action-recorder:session:action-delay',
			(/** @type {string} */ sessionId, /** @type {string} */ actionId, /** @type {number} */ delay0) => {
				if (!this.#currentSession || this.#currentSession.id !== sessionId)
					throw new Error(`Invalid session: ${sessionId}`)

				const delay = Number(delay0)

				if (isNaN(delay) || delay < 0) throw new Error(`Invalid delay: ${delay0}`)

				// Find and update the action
				const index = this.#currentSession.actions.findIndex((a) => a.id === actionId)
				if (index !== -1) {
					this.#currentSession.actions[index].delay = delay

					this.commitChanges([sessionId])
				}
			}
		)
		client.onPromise(
			'action-recorder:session:action-set-value',
			(
				/** @type {string} */ sessionId,
				/** @type {any} */ actionId,
				/** @type {string } */ key,
				/** @type {any} */ value
			) => {
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
			}
		)
		client.onPromise(
			'action-recorder:session:action-reorder',
			(/** @type {string} */ sessionId, /** @type {number} */ oldIndex, /** @type {number} */ newIndex) => {
				if (!this.#currentSession || this.#currentSession.id !== sessionId)
					throw new Error(`Invalid session: ${sessionId}`)

				oldIndex = clamp(oldIndex, 0, this.#currentSession.actions.length)
				newIndex = clamp(newIndex, 0, this.#currentSession.actions.length)
				this.#currentSession.actions.splice(newIndex, 0, ...this.#currentSession.actions.splice(oldIndex, 1))

				this.commitChanges([sessionId])
			}
		)
		client.onPromise(
			'action-recorder:session:save-to-control',
			(
				/** @type {string} */ sessionId,
				/** @type {string} */ controlId,
				/** @type {string} */ stepId,
				/** @type {string} */ setId,
				/** @type {string} */ mode
			) => {
				if (!this.#currentSession || this.#currentSession.id !== sessionId)
					throw new Error(`Invalid session: ${sessionId}`)

				this.saveToControlId(controlId, stepId, setId, mode)
			}
		)
	}

	/**
	 * Commit any changes to interested clients.
	 * Informs all clients about the 'list' of sessions, and any interested clients about specified sessions
	 * @param {Array<string>} sessionIds any sessions that have changed and should be diffed
	 * @access protected
	 */
	commitChanges(sessionIds) {
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

		/** @type {Record<string, RecordSessionListInfo>} */
		const newSessionListJson = {}

		if (this.#currentSession) {
			newSessionListJson[this.#currentSession.id] = {
				connectionIds: cloneDeep(this.#currentSession.connectionIds),
			}
		}

		if (this.#registry.io.countRoomMembers(SessionListRoom) > 0) {
			const patch = jsonPatch.compare(this.#lastSentSessionListJson || {}, newSessionListJson || {})
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
	 * @access public
	 * @param {boolean} [preserveConnections]
	 */
	destroySession(preserveConnections) {
		const oldSession = this.#currentSession

		this.#currentSession.isRunning = false
		this.#syncRecording()

		const newId = nanoid()
		this.#currentSession = {
			id: newId,
			connectionIds: [],
			isRunning: false,
			actionDelay: 0,
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
	discardActions() {
		this.#currentSession.actions = []

		this.commitChanges([this.#currentSession.id])
	}

	getSession() {
		return this.#currentSession
	}

	/**
	 * An conncetion has just started/stopped, make sure it is aware if it should be recording
	 * @param {string} connectionId
	 * @param {boolean} running Whether it is now running
	 */
	connectionAvailabilityChange(connectionId, running) {
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
	 * @access public
	 * @param {string} connectionId
	 * @param {string} actionId
	 * @param {Record<string,any>} options
	 * @param {string | undefined} uniquenessId
	 */
	receiveAction(connectionId, actionId, options, uniquenessId) {
		const changedSessionIds = []

		if (this.#currentSession) {
			const session = this.#currentSession

			if (session.connectionIds.includes(connectionId)) {
				/** @type {RecordActionTmp} */
				const newAction = {
					id: nanoid(),
					instance: connectionId,
					action: actionId,
					options: options,
					delay: session.actionDelay ?? 0,

					uniquenessId,
				}

				// Replace existing action with matching uniquenessId, or push to end of the list
				const uniquenessIdIndex = session.actions.findIndex(
					(act) => act.uniquenessId && act.uniquenessId === uniquenessId
				)
				if (uniquenessIdIndex !== -1) {
					session.actions[uniquenessIdIndex] = newAction
				} else {
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
	 * @param {string} controlId The id of the control
	 * @param {string} stepId
	 * @param {string} setId The action-set to write to (if applicable)
	 * @param {string} mode 'replace' or 'append'
	 */
	saveToControlId(controlId, stepId, setId, mode) {
		if (mode !== 'replace' && mode !== 'append') throw new Error(`Invalid mode: ${mode}`)

		const control = this.#registry.controls.getControl(controlId)
		if (!control) throw new Error(`Unknown control: ${controlId}`)

		if (mode === 'append') {
			if (control.supportsActions) {
				if (!control.actionAppend(stepId, setId, this.#currentSession.actions)) throw new Error('Unknown set')
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
	 * @param {boolean} isRunning
	 */
	setRecording(isRunning) {
		this.#currentSession.isRunning = !!isRunning
		this.#syncRecording()

		this.commitChanges([this.#currentSession.id])
	}

	/**
	 * Set the current connections being recorded from
	 * @param {Array<string>} connectionIds0
	 */
	setSelectedConnectionIds(connectionIds0) {
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
	#syncRecording() {
		const ps = []

		const targetRecordingConnectionIds = new Set()
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
					connection.startStopRecordingActions(true).catch((/** @type {any} */ e) => {
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
						connection.startStopRecordingActions(false).catch((/** @type {any} */ e) => {
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
