/*
 * Host side of the module data channel transport.
 *
 * The framed message transport (see FramedMessageChannel.ts) used to ride on an extra stdio fd, but that
 * cannot work on Windows: libuv implements stdio fd 3+ as named pipes rather than inheritable fds, so the
 * child has no fd to attach a net.Socket to. Instead the host listens on a socket (a named pipe on Windows,
 * a unix domain socket elsewhere), passes the path to the child via env, and the child connects back.
 *
 * Holding the path is the capability - it carries a random component and lives in a directory only the
 * current user can write to - so no separate handshake is needed to authenticate the child.
 */

import crypto from 'node:crypto'
import { EventEmitter } from 'node:events'
import fs from 'node:fs/promises'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import LogController, { type Logger } from '../../Log/Controller.js'

/**
 * Generate a unique path for a child's data channel. Kept short, as unix domain socket paths are limited to
 * ~104 characters on macOS and ~108 on Linux.
 */
export function makeDataChannelPath(pid: number = process.pid): string {
	const id = `${pid}-${crypto.randomBytes(6).toString('hex')}`
	return process.platform === 'win32'
		? `\\\\.\\pipe\\companion-ipc-${id}`
		: path.join(os.tmpdir(), `companion-ipc-${id}.sock`)
}

export interface DataChannelServerEvents {
	/** A child has connected and its socket is ready to carry framed messages */
	connect: [socket: net.Socket]
	/** The connected child's socket has gone away. A later `connect` may follow, once the child is respawned */
	disconnect: []
}

/**
 * A listening socket for exactly one child process at a time.
 *
 * The child is respawned repeatedly by RespawnMonitor and each incarnation connects afresh, so the server
 * outlives any single connection. It only accepts a connection when one is expected - that is, when a spawn
 * has happened since the last one connected. Anything else is a client that should not know the path at all,
 * so it is dropped and logged rather than trusted.
 */
export class DataChannelServer extends EventEmitter<DataChannelServerEvents> {
	readonly #logger: Logger
	readonly #server: net.Server
	readonly socketPath: string

	#socket: net.Socket | null = null
	#expectingConnection = false
	#closed = false

	private constructor(socketPath: string, instanceId: string) {
		super()

		this.#logger = LogController.createLogger(`Instance/DataChannel/${instanceId}`)
		this.socketPath = socketPath
		this.#server = net.createServer((socket) => this.#handleConnection(socket))
		this.#server.on('error', (err) => {
			// Nothing to recover here - a child that cannot reach us fails to register and is restarted.
			if (!this.#closed) this.#logger.error(`Data channel server error: ${err}`)
		})
	}

	/**
	 * Create a server and wait for it to be listening. Must complete before the child is spawned, so the
	 * child never races against a socket that does not exist yet.
	 */
	static async create(instanceId: string): Promise<DataChannelServer> {
		const server = new DataChannelServer(makeDataChannelPath(), instanceId)
		await server.#listen()
		return server
	}

	async #listen(): Promise<void> {
		try {
			await this.#listenOnce()
		} catch (e: any) {
			// A leftover socket file from an unclean exit. The path carries a random component so this should
			// not be reachable, but recovering costs one unlink and it would otherwise be unstartable forever.
			if (e?.code !== 'EADDRINUSE' || process.platform === 'win32') throw e

			this.#logger.warn(`Removing stale data channel socket "${this.socketPath}"`)
			await fs.rm(this.socketPath, { force: true })
			await this.#listenOnce()
		}
	}

	async #listenOnce(): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			const onError = (err: Error) => {
				this.#server.off('listening', onListening)
				reject(err)
			}
			const onListening = () => {
				this.#server.off('error', onError)
				resolve()
			}

			this.#server.once('error', onError)
			this.#server.once('listening', onListening)
			this.#server.listen(this.socketPath)
		})
	}

	/**
	 * Tell the server a child is about to start, so the next connection is a legitimate one.
	 * Any socket from a previous incarnation of the child is dropped.
	 */
	expectConnection(): void {
		if (this.#closed) return

		this.#dropSocket()
		this.#expectingConnection = true
	}

	#handleConnection(socket: net.Socket): void {
		if (!this.#expectingConnection) {
			// Each child builds its data socket once, in its entrypoint, and cannot rebuild it without being
			// respawned - which would have armed expectConnection() first. So this is either a second socket
			// from a child that should not have opened one, or a client that is not our child at all.
			this.#logger.warn(`Rejected unexpected connection to data channel "${this.socketPath}"`)
			socket.destroy()
			return
		}

		this.#expectingConnection = false
		this.#socket = socket

		socket.on('close', () => {
			// A child that has lost its socket cannot get another; treat it as gone until it is respawned.
			if (this.#socket !== socket) return
			this.#socket = null
			this.emit('disconnect')
		})

		this.emit('connect', socket)
	}

	#dropSocket(): void {
		const socket = this.#socket
		if (!socket) return

		this.#socket = null
		socket.destroy()
		this.emit('disconnect')
	}

	/**
	 * Stop listening and tear down any live connection. On posix this unlinks the socket file, so nothing is
	 * left behind once the child is gone; windows reclaims named pipes itself.
	 */
	close(): void {
		if (this.#closed) return
		this.#closed = true

		this.#dropSocket()
		this.#server.close()
	}
}
