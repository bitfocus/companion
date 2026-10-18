import net from 'node:net'
import express from 'express'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { sendOverIpc } from '../../lib/Resources/Util.js'
import { UIServer } from '../../lib/UI/Server.js'

vi.mock('../../lib/Resources/Util.js', () => ({
	sendOverIpc: vi.fn(),
}))

async function listenOnFreePort(): Promise<net.Server> {
	const server = net.createServer()
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
	return server
}

function portOf(server: net.Server): number {
	const address = server.address()
	if (!address || typeof address === 'string') throw new Error('Server is not listening on a port')
	return address.port
}

describe('UIServer.rebindHttp', () => {
	const servers: net.Server[] = []

	afterEach(() => {
		for (const server of servers.splice(0)) server.close()
		vi.mocked(sendOverIpc).mockClear()
	})

	test('reports running with the url to launch', async () => {
		const blocker = await listenOnFreePort()
		const port = portOf(blocker)
		await new Promise((resolve) => blocker.close(resolve))

		const server = new UIServer(express())
		servers.push(server)
		server.rebindHttp('127.0.0.1', port)

		await vi.waitFor(() =>
			expect(sendOverIpc).toHaveBeenCalledWith({
				messageType: 'http-bind-status',
				appStatus: 'running',
				appMessage: null,
				appLaunch: `http://127.0.0.1:${port}/`,
			})
		)
	})

	test('reports an error when the port is already in use', async () => {
		const blocker = await listenOnFreePort()
		servers.push(blocker)
		const port = portOf(blocker)

		const server = new UIServer(express())
		servers.push(server)
		server.rebindHttp('127.0.0.1', port)

		await vi.waitFor(() =>
			expect(sendOverIpc).toHaveBeenCalledWith({
				messageType: 'http-bind-status',
				appStatus: 'error',
				appMessage: `Port ${port} is already in use. Choose another port.`,
				appLaunch: null,
			})
		)
	})

	test('says when it is listening on all interfaces', async () => {
		const server = new UIServer(express())
		servers.push(server)
		server.rebindHttp('0.0.0.0', 0)

		await vi.waitFor(() =>
			expect(sendOverIpc).toHaveBeenCalledWith(
				expect.objectContaining({
					appStatus: 'running',
					appMessage: 'Listening on all network interfaces',
				})
			)
		)
	})

	test('reports only the latest bind when rebinding after a failure', async () => {
		const blockerA = await listenOnFreePort()
		const blockerB = await listenOnFreePort()
		servers.push(blockerA, blockerB)

		const server = new UIServer(express())
		servers.push(server)

		server.rebindHttp('127.0.0.1', portOf(blockerA))
		await vi.waitFor(() => expect(sendOverIpc).toHaveBeenCalledTimes(1))

		vi.mocked(sendOverIpc).mockClear()
		server.rebindHttp('127.0.0.1', portOf(blockerB))
		await vi.waitFor(() => expect(sendOverIpc).toHaveBeenCalledTimes(1))
		// Give a stale listener from the first bind the chance to report too
		await new Promise((resolve) => setTimeout(resolve, 20))

		expect(sendOverIpc).toHaveBeenCalledTimes(1)
		expect(sendOverIpc).toHaveBeenCalledWith(
			expect.objectContaining({
				appMessage: `Port ${portOf(blockerB)} is already in use. Choose another port.`,
			})
		)
	})

	test('reports any other bind failure as an error', async () => {
		const server = new UIServer(express())
		servers.push(server)
		server.rebindHttp('not-a-valid-host.invalid', 0)

		await vi.waitFor(() =>
			expect(sendOverIpc).toHaveBeenCalledWith(
				expect.objectContaining({
					appStatus: 'error',
					appMessage: expect.stringMatching(/^Could not start the web server: /),
					appLaunch: null,
				})
			)
		)
	})

	test('reports an error when the interface is unavailable', async () => {
		const server = new UIServer(express())
		servers.push(server)
		// TEST-NET-3, never assigned to a local interface
		server.rebindHttp('203.0.113.1', 0)

		await vi.waitFor(() =>
			expect(sendOverIpc).toHaveBeenCalledWith({
				messageType: 'http-bind-status',
				appStatus: 'error',
				appMessage: '203.0.113.1 is unavailable. Select another interface.',
				appLaunch: null,
			})
		)
	})
})
