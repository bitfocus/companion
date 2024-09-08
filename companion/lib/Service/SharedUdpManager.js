import { Socket, createSocket } from 'dgram'
import { nanoid } from 'nanoid'
import LogController from '../Log/Controller.js'

/**
 * Class providing 'shared' udp sockets for modules.
 *
 * @author Julian Waller <me@julusian.co.uk>
 * @since 3.3.0
 * @copyright 2024 Bitfocus AS
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
export class ServiceSharedUdpManager {
	// /**
	//  * The logger for this class
	//  * @type {import('winston').Logger}
	//  * @access private
	//  */
	// #logger = LogController.createLogger(`Service/SharedUdpManager`)

	/**
	 * @type {Map<string, ServiceSharedUdpPort>}
	 */
	#sockets = new Map()

	/**
	 * Count the number of active ports
	 * @returns {number}
	 */
	countActivePorts() {
		return this.#sockets.size
	}

	/**
	 * Add a listener
	 * @param {'udp4' | 'udp6'} family
	 * @param {number} portNumber
	 * @param {string} ownerId
	 * @param {( message: Buffer, rInfo: import('dgram').RemoteInfo) => void} messageHandler
	 * @param {( error: Error) => void} errorHandler
	 * @returns {Promise<string>}
	 */
	async joinPort(family, portNumber, ownerId, messageHandler, errorHandler) {
		const socketId = createSocketId(family, portNumber)

		let socket = this.#sockets.get(socketId)
		if (!socket) {
			socket = new ServiceSharedUdpPort(family, portNumber, () => {
				// Remove socket from the store, if it is the 'current' socket handler
				const newSocket = this.#sockets.get(socketId)
				if (newSocket === socket) {
					this.#sockets.delete(socketId)
				}
			})
			this.#sockets.set(socketId, socket)
		}
		const handleId = nanoid()

		socket.members.push({
			handleId,
			ownerId,
			messageHandler,
			errorHandler,
		})
		socket.logMemberCount()

		await socket.waitForBind

		return handleId
	}

	/**
	 * Remove a listener
	 * @param {string} ownerId
	 * @param {string} handleId
	 */
	leavePort(ownerId, handleId) {
		for (const [socketId, socket] of this.#sockets.entries()) {
			socket.members = socket.members.filter((m) => m.ownerId !== ownerId || m.handleId !== handleId)
			socket.logMemberCount()

			if (socket.members.length === 0) {
				this.#sockets.delete(socketId)

				socket.dispose()
			}
		}
	}

	/**
	 * Remove all listeners belonging to an owner
	 * @param {string} ownerId
	 */
	leaveAllFromOwner(ownerId) {
		for (const [socketId, socket] of this.#sockets.entries()) {
			socket.members = socket.members.filter((m) => m.ownerId !== ownerId)
			socket.logMemberCount()

			if (socket.members.length === 0) {
				this.#sockets.delete(socketId)

				socket.dispose()
			}
		}
	}

	/**
	 * Send a message from a shared port
	 * @param {string} ownerId
	 * @param {string} handleId
	 * @param {string} address
	 * @param {number} port
	 * @param {Uint8Array} message
	 */
	sendOnPort(ownerId, handleId, address, port, message) {
		const socket = this.#findSocket(ownerId, handleId)
		if (!socket) throw new Error(`Not a member of the socket`)

		socket.socket.send(message, port, address)
	}

	/**
	 *
	 * @param {string} ownerId
	 * @param {string} handleId
	 * @returns {ServiceSharedUdpPort | undefined}
	 */
	#findSocket(ownerId, handleId) {
		for (const socket of this.#sockets.values()) {
			if (socket.members.find((m) => m.ownerId === ownerId && m.handleId === handleId)) {
				return socket
			}
		}
		return undefined
	}
}

/**
 * @param {'udp4' | 'udp6'} type
 * @param {number} portNumber
 * @returns {string}
 */
function createSocketId(type, portNumber) {
	return `${type}-${portNumber}`
}

class ServiceSharedUdpPort {
	/**
	 * The logger for this class
	 * @type {import('winston').Logger}
	 * @access private
	 */
	#logger

	/** @type {ServiceSharedUdpMember[]} */
	members = []

	/** @type {Socket} */
	socket

	/** @type {Promise<void>} */
	waitForBind

	/**
	 * @param {'udp4' | 'udp6'} family
	 * @param {number} portNumber
	 * @param {() => void} destroyCallback
	 */
	constructor(family, portNumber, destroyCallback) {
		this.#logger = LogController.createLogger(`Service/SharedUdpPort/${family}/${portNumber}`)

		this.#logger.info('Initialising shared socket')

		this.socket = createSocket(family, (message, rinfo) => {
			for (const member of this.members) {
				member.messageHandler(message, rinfo)
			}
		})

		let hasBound = false

		this.socket.on('error', (error) => {
			this.#logger.warn(`Socket error: ${error?.message ?? error}`)
			destroyCallback()

			if (hasBound) {
				for (const member of this.members) {
					member.errorHandler(error)
				}
			}
		})

		this.waitForBind = /** @type {Promise<void>} */ (
			new Promise((resolve, reject) => {
				this.socket.once('error', reject)
				this.socket.bind(portNumber, resolve)
			})
		)

		this.waitForBind.finally(() => {
			hasBound = true
		})
	}

	logMemberCount() {
		this.#logger.debug(`Now has ${this.members.length} members`)
	}

	/**
	 * Dispose of this shared socket
	 */
	dispose() {
		this.#logger.info('Disposing of shared socket')

		this.socket.close()
	}
}

/**
 * @typedef {{
 *   ownerId: string
 *   handleId: string
 *   messageHandler: (message: Buffer, rInfo: import('dgram').RemoteInfo) => void
 *   errorHandler: (error: Error) => void
 * }} ServiceSharedUdpMember
 */
