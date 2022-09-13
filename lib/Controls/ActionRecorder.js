import { clone, cloneDeep } from 'lodash-es'
import { nanoid } from 'nanoid'
import CoreBase from '../Core/Base.js'
import { ParseControlId } from '../Resources/Util.js'
import jsonPatch from 'fast-json-patch'

const SessionListRoom = 'action-recorder:session-list'
function SessionRoom(id) {
	return `action-recorder:session:${id}`
}

/**
 * Class to handle recording of actions onto a control.
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
	 * Data from the current recording session
	 * @access private
	 */
	#session

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
		this.#session = {
			id: nanoid(),
			instanceIds: [],
			isRunning: false,
			actionDelay: 0,
			actions: [],
		}

		this.commitChanges([this.#session.id])
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
		// 	if (this.#session) throw new Error('Already active')

		// 	if (!Array.isArray(instanceIds0)) throw new Error('Expected array of instance ids')
		// 	const allValidIds = new Set(this.instance.getAllInstanceIds())
		// 	const instanceIds = instanceIds0.filter((id) => allValidIds.has(id))
		// 	if (instanceIds.length === 0) throw new Error('No instance ids provided')

		// 	const id = nanoid()
		// 	this.#session = {
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
			if (!this.#session || this.#session.id !== sessionId) throw new Error(`Invalid session: ${sessionId}`)

			this.#session.isRunning = false
			this.syncRecording()

			const newId = nanoid()
			this.#session = {
				id: newId,
				instanceIds: [],
				isRunning: false,
				actionDelay: 0,
				actions: [],
			}

			this.commitChanges([sessionId, newId])

			return true
		})
		client.onPromise('action-recorder:session:discard-actions', (sessionId) => {
			if (!this.#session || this.#session.id !== sessionId) throw new Error(`Invalid session: ${sessionId}`)

			this.#session.actions = []

			this.commitChanges([sessionId])

			return true
		})
		client.onPromise('action-recorder:session:recording', (sessionId, isRunning) => {
			if (!this.#session || this.#session.id !== sessionId) throw new Error(`Invalid session: ${sessionId}`)

			this.#session.isRunning = !!isRunning
			this.syncRecording()

			this.commitChanges([sessionId])

			return true
		})
		client.onPromise('action-recorder:session:set-instances', (sessionId, instanceIds0) => {
			if (!this.#session || this.#session.id !== sessionId) throw new Error(`Invalid session: ${sessionId}`)

			if (!Array.isArray(instanceIds0)) throw new Error('Expected array of instance ids')
			const allValidIds = new Set(this.instance.getAllInstanceIds())
			const instanceIds = instanceIds0.filter((id) => allValidIds.has(id))

			this.#session.instanceIds = instanceIds
			this.syncRecording()

			this.commitChanges([sessionId])

			return true
		})

		// TODO

		client.onPromise('action-recorder:session:subscribe', (sessionId) => {
			if (!this.#session || this.#session.id !== sessionId) throw new Error(`Invalid session: ${sessionId}`)

			client.join(SessionRoom(sessionId))

			return this.#lastSentSessionInfoJsons[sessionId]
		})
		client.onPromise('action-recorder:session:unsubscribe', (sessionId) => {
			client.leave(SessionRoom(sessionId))
		})
	}

	commitChanges(sessionIds) {
		if (sessionIds && Array.isArray(sessionIds)) {
			for (const sessionId of sessionIds) {
				const sessionInfo = this.#session && this.#session.id === sessionId ? this.#session : null

				const newSessionBlob = sessionInfo ? clone(sessionInfo) : null

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

		if (this.#session) {
			newSessionListJson[this.#session.id] = {
				instanceIds: cloneDeep(this.#session.instanceIds),
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

	/**
	 * Add an action received from an instance to the session
	 * @access public
	 */
	receiveAction(instanceId, actionId, options, uniquenessId) {
		// TODO
		console.log('receiveAction')
	}

	syncRecording() {
		// TODO
		console.log('syncRecording')
	}
}
