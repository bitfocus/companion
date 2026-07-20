/*
 * Child side of the module data channel transport (see DataChannelServer.ts for why this is a socket rather
 * than an inherited stdio fd). Kept apart from the server so a child never pulls the host code into its bundle.
 */

import net from 'node:net'

const CONNECT_ATTEMPTS = 10
const CONNECT_RETRY_INTERVAL = 100

/**
 * Connect to the host's data channel. The host listens before spawning us, so the first attempt should
 * always succeed; the retries are only a guard against a slow or contended socket at startup.
 *
 * This covers the initial connect only. Once connected, losing the socket is terminal - the host will not
 * accept a replacement without respawning the process.
 */
export async function connectDataChannel(socketPath: string): Promise<net.Socket> {
	let lastError: unknown = null

	for (let attempt = 0; attempt < CONNECT_ATTEMPTS; attempt++) {
		if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, CONNECT_RETRY_INTERVAL))

		try {
			return await connectOnce(socketPath)
		} catch (e) {
			lastError = e
		}
	}

	throw new Error(`Failed to connect to host data channel "${socketPath}": ${lastError}`)
}

async function connectOnce(socketPath: string): Promise<net.Socket> {
	return new Promise<net.Socket>((resolve, reject) => {
		const socket = net.connect(socketPath)

		const onError = (err: Error) => {
			socket.destroy()
			reject(err)
		}
		socket.once('error', onError)
		socket.once('connect', () => {
			socket.off('error', onError)
			resolve(socket)
		})
	})
}
