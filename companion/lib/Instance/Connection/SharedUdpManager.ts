import { Socket, createSocket } from 'dgram'
import { nanoid } from 'nanoid'
import LogController, { Logger } from '../../Log/Controller.js'

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
 */
export class InstanceSharedUdpManager {
	// /**
	//  * The logger for this class
	//  */
	// #logger = LogController.createLogger(`Service/SharedUdpManager`)

	#sockets = new Map<string, InstanceSharedUdpPort>()

	/**
	 * Count the number of active ports
	 */
	countActivePorts(): number {
		return this.#sockets.size
	}

	/**
	 * Add a listener
	 */
	async joinPort(
		family: 'udp4' | 'udp6',
		portNumber: number,
		ownerId: string,
		messageHandler: InstanceSharedUdpMember['messageHandler'],
		errorHandler: InstanceSharedUdpMember['errorHandler']
	): Promise<string> {
		const socketId = createSocketId(family, portNumber)

		let socket = this.#sockets.get(socketId)
		if (!socket) {
			socket = new InstanceSharedUdpPort(family, portNumber, () => {
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
	 */
	leavePort(ownerId: string, handleId: string): void {
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
	 */
	leaveAllFromOwner(ownerId: string): void {
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
	 */
	sendOnPort(ownerId: string, handleId: string, address: string, port: number, message: Uint8Array): void {
		const socket = this.#findSocket(ownerId, handleId)
		if (!socket) throw new Error(`Not a member of the socket`)

		socket.socket.send(message, port, address)
	}

	#findSocket(ownerId: string, handleId: string): InstanceSharedUdpPort | undefined {
		for (const socket of this.#sockets.values()) {
			if (socket.members.find((m) => m.ownerId === ownerId && m.handleId === handleId)) {
				return socket
			}
		}
		return undefined
	}
}

function createSocketId(type: 'udp4' | 'udp6', portNumber: number): string {
	return `${type}-${portNumber}`
}

class InstanceSharedUdpPort {
	/**
	 * The logger for this class
	 */
	#logger: Logger

	members: InstanceSharedUdpMember[] = []
	readonly socket: Socket
	readonly waitForBind: Promise<void>

	constructor(family: 'udp4' | 'udp6', portNumber: number, destroyCallback: () => void) {
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

		this.waitForBind = new Promise<void>((resolve, reject) => {
			this.socket.once('error', reject)
			this.socket.bind(portNumber, resolve)
		})

		this.waitForBind
			.finally(() => {
				hasBound = true
			})
			.catch(() => null)
	}

	logMemberCount(): void {
		this.#logger.debug(`Now has ${this.members.length} members`)
	}

	/**
	 * Dispose of this shared socket
	 */
	dispose(): void {
		this.#logger.info('Disposing of shared socket')

		this.socket.close()
	}
}

interface InstanceSharedUdpMember {
	ownerId: string
	handleId: string
	messageHandler: (message: Buffer, rInfo: import('dgram').RemoteInfo) => void
	errorHandler: (error: Error) => void
}
