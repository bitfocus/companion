import dgram from 'node:dgram'
import net from 'node:net'
import { describe, expect, test } from 'vitest'
import { getFreeTcpPort, getFreeUdpPort } from './TestApp.js'

// The api services in these tests are pointed at a port by userconfig, so the port has to still be
// theirs alone by the time the service binds it - and still be nobody's once the service stops, or
// a test asserting that the service has shut down finds the port answering for someone else

/** Hold a tcp port for the duration of `fn` */
async function holdTcpPort(port: number, fn: () => Promise<void>): Promise<void> {
	const server = net.createServer()
	await new Promise<void>((resolve, reject) => {
		server.on('error', reject)
		server.listen(port, '0.0.0.0', resolve)
	})
	try {
		await fn()
	} finally {
		await new Promise<void>((resolve) => server.close(() => resolve()))
	}
}

/** Hold a udp port for the duration of `fn` */
async function holdUdpPort(port: number, fn: () => Promise<void>): Promise<void> {
	const socket = dgram.createSocket('udp4')
	await new Promise<void>((resolve, reject) => {
		socket.on('error', reject)
		socket.bind(port, '0.0.0.0', resolve)
	})
	try {
		await fn()
	} finally {
		await new Promise<void>((resolve) => socket.close(() => resolve()))
	}
}

describe('free port helpers', () => {
	test('a tcp port comes from below the ephemeral range and is bindable', async () => {
		const port = await getFreeTcpPort()

		// Below 32768, where linux starts handing out ephemeral ports of its own accord
		expect(port).toBeGreaterThanOrEqual(20_000)
		expect(port).toBeLessThan(32_000)

		// Bindable on the wildcard address, which is what the services do
		await holdTcpPort(port, async () => {
			// And a port that is taken is never handed out again
			for (let i = 0; i < 20; i++) {
				expect(await getFreeTcpPort()).not.toBe(port)
			}
		})
	})

	test('a udp port comes from below the ephemeral range and is bindable', async () => {
		const port = await getFreeUdpPort()

		expect(port).toBeGreaterThanOrEqual(20_000)
		expect(port).toBeLessThan(32_000)

		await holdUdpPort(port, async () => {
			for (let i = 0; i < 20; i++) {
				expect(await getFreeUdpPort()).not.toBe(port)
			}
		})
	})
})
