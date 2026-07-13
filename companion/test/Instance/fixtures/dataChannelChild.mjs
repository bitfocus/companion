/*
 * Stands in for a module child process, for the data channel integration test. Deliberately hand-rolls the
 * framing (see MessageFraming.ts, which is unit tested separately) rather than importing the typescript
 * sources, so it can be run by a real node binary the way a real child is.
 *
 * Echoes back every message it is sent, along with what it can see of its own plumbing.
 */

import net from 'node:net'

const socketPath = process.env.MODULE_DATA_CHANNEL
if (!socketPath) {
	console.error('MODULE_DATA_CHANNEL is missing')
	process.exit(2)
}

const socket = net.connect(socketPath)

// Losing the channel is terminal for a child, exactly as in the real entrypoints
socket.on('close', () => process.exit(0))
socket.on('error', (e) => {
	console.error(`data channel error: ${e}`)
	process.exit(3)
})

function send(message) {
	const body = Buffer.from(JSON.stringify(message), 'utf8')
	const header = Buffer.allocUnsafe(4)
	header.writeUInt32BE(body.length, 0)
	socket.write(Buffer.concat([header, body]))
}

let buffer = Buffer.alloc(0)
socket.on('data', (chunk) => {
	buffer = Buffer.concat([buffer, chunk])

	for (;;) {
		if (buffer.length < 4) return

		const bodyLength = buffer.readUInt32BE(0)
		if (buffer.length < 4 + bodyLength) return

		const message = JSON.parse(buffer.subarray(4, 4 + bodyLength).toString('utf8'))
		buffer = buffer.subarray(4 + bodyLength)

		send({
			echo: message,
			// The 'ipc' channel is still there for the disconnect signal, but carries no messages
			hasIpcChannel: typeof process.send === 'function',
			// Whether the permission model is restricting this process, as it does for real connections
			hasPermissionModel: !!process.permission,
		})
	}
})
