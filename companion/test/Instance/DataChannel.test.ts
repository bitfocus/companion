import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync } from 'node:fs'
import net from 'node:net'
import path from 'node:path'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { connectDataChannel } from '../../lib/Instance/Common/DataChannelClient.js'
import { DataChannelServer, makeDataChannelPath } from '../../lib/Instance/Common/DataChannelServer.js'
import { FramedChannel, HostFramedTransport } from '../../lib/Instance/Common/FramedMessageChannel.js'

const isWindows = process.platform === 'win32'

/** Servers opened by a test, torn down afterwards so no test leaves a listening socket behind */
const openServers: DataChannelServer[] = []

async function createServer(): Promise<DataChannelServer> {
	const server = await DataChannelServer.create('test-instance')
	openServers.push(server)
	return server
}

/** Wait for a condition driven by socket io, which needs real event loop turns to settle */
async function waitFor(check: () => boolean, timeout = 2000): Promise<void> {
	const expiry = Date.now() + timeout
	while (!check()) {
		if (Date.now() > expiry) throw new Error('Timed out waiting for condition')
		await new Promise((resolve) => setTimeout(resolve, 5))
	}
}

afterEach(() => {
	for (const server of openServers) server.close()
	openServers.length = 0
})

describe('makeDataChannelPath', () => {
	test('uses the right transport for the platform', () => {
		const path = makeDataChannelPath(1234)

		if (isWindows) {
			expect(path).toMatch(/^\\\\\.\\pipe\\companion-ipc-1234-[0-9a-f]{12}$/)
		} else {
			expect(path).toMatch(/companion-ipc-1234-[0-9a-f]{12}\.sock$/)
			// Unix domain socket paths are limited to ~104 characters
			expect(path.length).toBeLessThan(100)
		}
	})

	test('is unique per call', () => {
		const paths = new Set(Array.from({ length: 100 }, () => makeDataChannelPath()))
		expect(paths.size).toBe(100)
	})
})

describe('DataChannelServer', () => {
	test('round-trips messages with a connected child', async () => {
		const server = await createServer()

		const hostReceived: unknown[] = []
		const transport = new HostFramedTransport(server, (msg) => hostReceived.push(msg))

		// No child yet, so there is nothing to send to
		expect(transport.send({ hello: 'nobody' })).toBe(0)

		server.expectConnection()
		const childSocket = await connectDataChannel(server.socketPath)

		const childReceived: unknown[] = []
		const childChannel = new FramedChannel(childSocket, (msg) => childReceived.push(msg))

		await waitFor(() => transport.send({ direction: 'call', name: 'register' }) > 0)
		childChannel.send({ direction: 'response', callbackId: 1 })

		await waitFor(() => childReceived.length > 0 && hostReceived.length > 0)
		expect(childReceived).toContainEqual({ direction: 'call', name: 'register' })
		expect(hostReceived).toEqual([{ direction: 'response', callbackId: 1 }])

		// The socket's own counters see the framed bytes, header included
		expect(childSocket.bytesRead).toBeGreaterThan(0)
		expect(childSocket.bytesWritten).toBeGreaterThan(0)

		childSocket.destroy()
	})

	test('reports the exact body byte count of each message', async () => {
		const server = await createServer()

		const received: [unknown, number][] = []
		const transport = new HostFramedTransport(server, (msg, bytes) => received.push([msg, bytes]))

		server.expectConnection()
		const childSocket = await connectDataChannel(server.socketPath)
		const childChannel = new FramedChannel(childSocket, () => undefined)

		const message = { direction: 'call', name: 'hello' }
		const sentBytes = childChannel.send(message)

		await waitFor(() => received.length > 0)
		expect(received).toEqual([[message, sentBytes]])
		expect(sentBytes).toBe(Buffer.byteLength(JSON.stringify(message), 'utf8'))

		// Same count as the host measures on its way out
		expect(transport.send(message)).toBe(sentBytes)

		childSocket.destroy()
	})

	test('rejects a second connection, leaving the first healthy', async () => {
		const server = await createServer()

		const hostReceived: unknown[] = []
		const transport = new HostFramedTransport(server, (msg) => hostReceived.push(msg))

		server.expectConnection()
		const childSocket = await connectDataChannel(server.socketPath)
		const childChannel = new FramedChannel(childSocket, () => undefined)

		// Nothing has respawned, so no further connection is legitimate
		const intruder = await connectDataChannel(server.socketPath)
		const intruderErrors: unknown[] = []
		intruder.on('error', (e) => intruderErrors.push(e))

		await waitFor(() => intruder.destroyed || intruder.readableEnded)
		expect(intruder.destroyed || intruder.readableEnded).toBe(true)

		// The real child is untouched
		childChannel.send({ direction: 'call', name: 'still-here' })
		await waitFor(() => hostReceived.length > 0)
		expect(hostReceived).toEqual([{ direction: 'call', name: 'still-here' }])
		expect(childSocket.destroyed).toBe(false)
		expect(transport.send({ direction: 'response' })).toBeGreaterThan(0)

		childSocket.destroy()
		intruder.destroy()
	})

	test('rebinds to the child on respawn, dropping the dead one', async () => {
		const server = await createServer()

		const hostReceived: unknown[] = []
		const transport = new HostFramedTransport(server, (msg) => hostReceived.push(msg))

		server.expectConnection()
		const firstSocket = await connectDataChannel(server.socketPath)
		new FramedChannel(firstSocket, () => undefined)
		await waitFor(() => transport.send({ to: 'first' }) > 0)

		// The child died and is being respawned
		firstSocket.destroy()
		await waitFor(() => transport.send({ to: 'nobody' }) === 0)

		server.expectConnection()
		const secondSocket = await connectDataChannel(server.socketPath)
		const secondReceived: unknown[] = []
		const secondChannel = new FramedChannel(secondSocket, (msg) => secondReceived.push(msg))

		await waitFor(() => transport.send({ to: 'second' }) > 0)
		secondChannel.send({ from: 'second' })

		await waitFor(() => secondReceived.length > 0 && hostReceived.length > 0)
		expect(secondReceived).toContainEqual({ to: 'second' })
		expect(hostReceived).toEqual([{ from: 'second' }])

		secondSocket.destroy()
	})

	test('stops carrying messages once the transport is destroyed', async () => {
		const server = await createServer()

		const hostReceived: unknown[] = []
		const transport = new HostFramedTransport(server, (msg) => hostReceived.push(msg))

		server.expectConnection()
		const childSocket = await connectDataChannel(server.socketPath)
		const childChannel = new FramedChannel(childSocket, () => undefined)

		await waitFor(() => transport.send({ direction: 'call' }) > 0)

		// The handler is being torn down, while the child is still alive and talking
		transport.destroy()

		expect(transport.send({ direction: 'call' })).toBe(0)

		childChannel.send({ direction: 'call', name: 'too-late' })
		await new Promise((resolve) => setTimeout(resolve, 50))
		expect(hostReceived).toEqual([])

		// A child connecting afterwards cannot reach the destroyed handler either
		server.expectConnection()
		const laterSocket = await connectDataChannel(server.socketPath)
		new FramedChannel(laterSocket, () => undefined).send({ direction: 'call', name: 'later' })
		await new Promise((resolve) => setTimeout(resolve, 50))
		expect(hostReceived).toEqual([])

		childSocket.destroy()
		laterSocket.destroy()
	})

	test('drops the live socket and stops listening on close', async () => {
		const server = await createServer()
		const transport = new HostFramedTransport(server, () => undefined)

		server.expectConnection()
		const childSocket = await connectDataChannel(server.socketPath)
		// A child always reads its socket; an unread socket stays paused and would never see the close
		new FramedChannel(childSocket, () => undefined)
		await waitFor(() => transport.send({ hello: 'child' }) > 0)

		server.close()

		await waitFor(() => childSocket.destroyed || childSocket.readableEnded)
		expect(transport.send({ hello: 'child' })).toBe(0)

		// Nothing may connect to a closed channel
		await expect(connectDataChannel(server.socketPath)).rejects.toThrow(/Failed to connect/)

		childSocket.destroy()
	})

	test.skipIf(isWindows)('leaves no socket file behind on close', async () => {
		const server = await createServer()
		expect(existsSync(server.socketPath)).toBe(true)

		server.close()

		await waitFor(() => !existsSync(server.socketPath))
	})
})

/*
 * The reason this transport exists: an inherited stdio fd cannot be picked up by the child on windows, so
 * the channel has to survive a real process boundary. Mirrors how ProcessManager spawns a child - same stdio
 * layout, same env, and the same permission flags a real connection runs under.
 */
describe('a real child process', () => {
	const fixture = path.join(import.meta.dirname, 'fixtures/dataChannelChild.mjs')

	const spawnedChildren: ChildProcess[] = []

	afterEach(() => {
		for (const child of spawnedChildren) child.kill()
		spawnedChildren.length = 0
	})

	function spawnChild(socketPath: string): ChildProcess {
		const child = spawn(
			process.execPath,
			[
				// As applied to real connections by getNodeJsPermissionArguments()
				'--permission',
				'--allow-net',
				`--allow-fs-read=${fixture}`,
				fixture,
			],
			{
				// fd 3 = 'ipc', and nothing beyond it - the data channel is a socket, not an inherited fd
				stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
				env: { ...process.env, MODULE_DATA_CHANNEL: socketPath },
			}
		)
		spawnedChildren.push(child)
		return child
	}

	test('connects and round-trips messages under the permission model', async () => {
		const server = await createServer()

		const received: unknown[] = []
		const transport = new HostFramedTransport(server, (msg) => received.push(msg))

		server.expectConnection()

		const child = spawnChild(server.socketPath)
		const stderr: string[] = []
		child.stderr?.on('data', (d) => stderr.push(d.toString()))

		// The child connects on its own, which is what makes this work on windows
		await waitFor(() => transport.send({ direction: 'call', name: 'register' }) > 0)
		await waitFor(() => received.length > 0)

		// Nothing was denied on the way (node also prints an ExperimentalWarning for --allow-net, which is fine)
		expect(stderr.join('')).not.toMatch(/Error|ERR_/)
		expect(received[0]).toEqual({
			echo: { direction: 'call', name: 'register' },
			hasIpcChannel: true,
			hasPermissionModel: true,
		})
	}, 20_000)

	test('is treated as gone once the child dies', async () => {
		const server = await createServer()
		const transport = new HostFramedTransport(server, () => undefined)

		server.expectConnection()
		const child = spawnChild(server.socketPath)

		await waitFor(() => transport.send({ direction: 'call' }) > 0)

		child.kill()
		await waitFor(() => transport.send({ direction: 'call' }) === 0)
	}, 20_000)
})

describe('connectDataChannel', () => {
	test('retries a path that is not listening yet', async () => {
		// As if the child had somehow won the race against the host's listen()
		const socketPath = makeDataChannelPath()
		const promise = connectDataChannel(socketPath)

		const server = net.createServer()
		await new Promise<void>((resolve) => server.listen(socketPath, resolve))

		try {
			const socket = await promise
			expect(socket.destroyed).toBe(false)
			socket.destroy()
		} finally {
			server.close()
		}
	})

	test('gives up on a path that never accepts', async () => {
		vi.useFakeTimers()
		try {
			// Assert before advancing, so the rejection is never left unhandled
			const assertion = expect(connectDataChannel(makeDataChannelPath())).rejects.toThrow(
				/Failed to connect to host data channel/
			)
			// Run out the backoff without waiting for it
			await vi.advanceTimersByTimeAsync(10_000)
			await assertion
		} finally {
			vi.useRealTimers()
		}
	})
})
