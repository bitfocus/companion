import { cloneDeep } from 'lodash-es'
import { nanoid } from 'nanoid'
import CoreBase from '../Core/Base.js'
import jsonPatch from 'fast-json-patch'
import { clamp, ParseControlId } from '../Resources/Util.js'

const SessionListRoom = 'action-recorder:session-list'
function SessionRoom(id) {
	return `action-recorder:session:${id}`
}

/**
 * Class to handle recording of actions onto a control.
 *
 * Note: This code has been written to be halfway to supporting multiple concurrent recording sessions.
 * In places where it doesnt add any/much complexity, to make it more futureproof.
 *
 * @extends CoreBase
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
export default class ActionRecorder extends CoreBase {
	/**
	 * The instance ids which are currently informed to be recording
	 * Note: this may contain some ids which are not,
	 * @access private
	 */
	#currentlyRecordingInstanceIds = new Set()

	/**
	 * Data from the current recording session
	 * @access private
	 */
	#currentSession

	/**
	 * The last sent info json object
	 * @access private
	 */
	#lastSentSessionListJson = null

	/**
	 * The last sent info json object
	 * @access private
	 */
	#lastSentSessionInfoJsons = {}

	/**
	 * @param {Registry} registry - the application core
	 */
	constructor(registry) {
		super(registry, 'action-recorder', 'Control/ActionRecorder')

		// create the 'default' session
		this.#currentSession = {
			id: nanoid(),
			instanceIds: [],
			isRunning: false,
			actionDelay: 0,
			actions: [],
		}

		this.commitChanges([this.#currentSession.id])
	}

	/**
	 * Setup a new socket client's events
	 * @param {SocketIO} client - the client socket
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
		client.onPromise('action-recorder:session:abort', (sessionId) => {
			if (!this.#currentSession || this.#currentSession.id !== sessionId)
				throw new Error(`Invalid session: ${sessionId}`)

			this.destroySession()

			return true
		})
		client.onPromise('action-recorder:session:discard-actions', (sessionId) => {
			if (!this.#currentSession || this.#currentSession.id !== sessionId)
				throw new Error(`Invalid session: ${sessionId}`)

			this.#currentSession.actions = []

			this.commitChanges([sessionId])

			return true
		})
		client.onPromise('action-recorder:session:recording', (sessionId, isRunning) => {
			if (!this.#currentSession || this.#currentSession.id !== sessionId)
				throw new Error(`Invalid session: ${sessionId}`)

			this.#currentSession.isRunning = !!isRunning
			this.#syncRecording()

			this.commitChanges([sessionId])

			return true
		})
		client.onPromise('action-recorder:session:set-instances', (sessionId, instanceIds0) => {
			if (!this.#currentSession || this.#currentSession.id !== sessionId)
				throw new Error(`Invalid session: ${sessionId}`)

			if (!Array.isArray(instanceIds0)) throw new Error('Expected array of instance ids')
			const allValidIds = new Set(this.instance.getAllInstanceIds())
			const instanceIds = instanceIds0.filter((id) => allValidIds.has(id))

			this.#currentSession.instanceIds = instanceIds
			this.#syncRecording()

			this.commitChanges([sessionId])

			return true
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
		client.onPromise('action-recorder:session:action-delay', (sessionId, actionId, delay0) => {
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
		client.onPromise('action-recorder:session:action-reorder', (sessionId, oldIndex, newIndex) => {
			if (!this.#currentSession || this.#currentSession.id !== sessionId)
				throw new Error(`Invalid session: ${sessionId}`)

			oldIndex = clamp(oldIndex, 0, this.#currentSession.actions.length)
			newIndex = clamp(newIndex, 0, this.#currentSession.actions.length)
			this.#currentSession.actions.splice(newIndex, 0, ...this.#currentSession.actions.splice(oldIndex, 1))

			this.commitChanges([sessionId])
		})
		client.onPromise('action-recorder:session:save-to-control', (sessionId, controlId, setId, mode) => {
			if (!this.#currentSession || this.#currentSession.id !== sessionId)
				throw new Error(`Invalid session: ${sessionId}`)

			if (mode !== 'replace' && mode !== 'append') throw new Error(`Invalid mode: ${mode}`)

			const parsedControlId = ParseControlId(controlId)
			if (!parsedControlId) throw new Error(`Invalid control: ${controlId}`)

			if (parsedControlId.type === 'trigger') {
				const trigger = this.triggers.get_trigger(parsedControlId.trigger)
				if (!trigger) throw new Error(`Unknown trigger: ${parsedControlId.trigger}`)

				this.triggers.update_schedule(null, parsedControlId.trigger, {
					...trigger,
					actions:
						mode === 'append'
							? [...trigger.actions, ...this.#currentSession.actions]
							: [...this.#currentSession.actions],
				})
			} else if (parsedControlId.type === 'bank') {
				const control = this.controls.getControl(controlId)
				if (!control) throw new Error(`Unknown control: ${controlId}`)

				if (mode === 'append') {
					if (typeof control.actionAppend === 'function') {
						if (!control.actionAppend(setId, this.#currentSession.actions)) throw new Error('Unknown set')
					} else {
						throw new Error('Not supported by control')
					}
				} else {
					if (typeof control.actionReplaceAll === 'function') {
						if (!control.actionReplaceAll(setId, this.#currentSession.actions)) throw new Error('Unknown set')
					} else {
						throw new Error('Not supported by control')
					}
				}
			} else {
				throw new Error(`Invalid control: ${controlId}`)
			}

			this.destroySession()
		})
	}

	commitChanges(sessionIds) {
		if (sessionIds && Array.isArray(sessionIds)) {
			for (const sessionId of sessionIds) {
				const sessionInfo = this.#currentSession && this.#currentSession.id === sessionId ? this.#currentSession : null

				const newSessionBlob = sessionInfo ? cloneDeep(sessionInfo) : null

				const room = SessionRoom(sessionId)
				if (this.io.countRoomMembers(room) > 0) {
					const patch = jsonPatch.compare(this.#lastSentSessionInfoJsons[sessionId] || {}, newSessionBlob || {})
					if (patch.length > 0) {
						this.io.emitToRoom(room, `action-recorder:session:update:${sessionId}`, patch)
					}
				}

				if (newSessionBlob) {
					this.#lastSentSessionInfoJsons[sessionId] = newSessionBlob
				} else {
					delete this.#lastSentSessionInfoJsons[sessionId]
				}
			}
		}

		const newSessionListJson = {}

		if (this.#currentSession) {
			newSessionListJson[this.#currentSession.id] = {
				instanceIds: cloneDeep(this.#currentSession.instanceIds),
			}
		}

		if (this.io.countRoomMembers(SessionListRoom) > 0) {
			const patch = jsonPatch.compare(this.#lastSentSessionListJson || {}, newSessionListJson || {})
			if (patch.length > 0) {
				this.io.emitToRoom(SessionListRoom, `action-recorder:session-list`, patch)
			}
		}

		this.#lastSentSessionListJson = newSessionListJson
	}

	destroySession() {
		const oldId = this.#currentSession.id

		this.#currentSession.isRunning = false
		this.#syncRecording()

		const newId = nanoid()
		this.#currentSession = {
			id: newId,
			instanceIds: [],
			isRunning: false,
			actionDelay: 0,
			actions: [],
		}

		this.commitChanges([oldId, newId])
	}

	/**
	 * An instance has just started/stopped, make sure it is aware if it should be recording
	 * @param {string} instanceId
	 * @param {boolean} running Whether it is now running
	 */
	instanceStatusChange(instanceId, running) {
		if (!running) {
			if (this.#currentSession) {
				// Remove the instance which has stopped
				const newIds = this.#currentSession.instanceIds.filter((id) => id !== instanceId)

				if (newIds.length !== this.#currentSession.instanceIds.length) {
					this.commitChanges(this.#currentSession)
				}
			}
		}
	}

	/**
	 * Add an action received from an instance to the session
	 * @access public
	 */
	receiveAction(instanceId, actionId, options, uniquenessId) {
		const changedSessionIds = []

		if (this.#currentSession) {
			const session = this.#currentSession

			if (session.instanceIds.includes(instanceId)) {
				const newAction = {
					id: nanoid(),
					instance: instanceId,
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
	 * Sync the correct recording status to each instance
	 * @access private
	 */
	async #syncRecording() {
		const ps = []

		const targetRecordingInstanceIds = new Set()
		if (this.#currentSession && this.#currentSession.isRunning) {
			for (const id of this.#currentSession.instanceIds) {
				targetRecordingInstanceIds.add(id)
			}
		}

		// Find ones to start recording
		for (const instanceId of targetRecordingInstanceIds.values()) {
			// Future: skip checking if they already know, to make sure they dont get stuck
			const instance = this.instance.moduleHost.getChild(instanceId)
			if (instance) {
				ps.push(
					instance.startStopRecordingActions(true).catch((e) => {
						this.logger.warn(`Failed to start recording for "${instanceId}": ${e}`)
					})
				)
			}
		}

		// Find ones to stop recording
		for (const instanceId of this.#currentlyRecordingInstanceIds.values()) {
			if (!targetRecordingInstanceIds.has(instanceId)) {
				const instance = this.instance.moduleHost.getChild(instanceId)
				if (instance) {
					ps.push(
						instance.startStopRecordingActions(false).catch((e) => {
							this.logger.warn(`Failed to stop recording for "${instanceId}": ${e}`)
						})
					)
				}
			}
		}

		this.#currentlyRecordingInstanceIds = targetRecordingInstanceIds

		// Wait for them all to be synced
		await Promise.all(ps).catch((e) => {
			this.logger.error(`Failed to syncRecording: ${e}`)
		})
	}
}
