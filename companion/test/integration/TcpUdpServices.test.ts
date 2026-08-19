import dgram from 'node:dgram'
import net from 'node:net'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { exprVal } from '@companion-app/shared/Model/Options.js'
import { createTestApp, type TestApp } from './TestApp.js'

// Booting the application takes a few seconds, so the default timeouts are too tight
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 })

async function tryConnectTcp(port: number): Promise<net.Socket> {
	return new Promise<net.Socket>((resolve, reject) => {
		const socket = net.connect({ host: '127.0.0.1', port }, () => resolve(socket))
		socket.on('error', reject)
	})
}

/** Connect to a freshly-enabled service, retrying until it is listening */
async function connectTcp(port: number): Promise<net.Socket> {
	return await vi.waitFor(async () => tryConnectTcp(port), { timeout: 5000 })
}

/** Collect reply lines from a socket */
function collectLines(socket: net.Socket): () => string[] {
	let buffer = ''
	socket.on('data', (chunk) => {
		buffer += chunk.toString()
	})
	return () => buffer.split('\n').filter((line) => !!line)
}

describe('tcp/udp api services over real sockets', () => {
	let app: TestApp
	beforeEach(async () => {
		app = await createTestApp({ configDir: null })
	})
	afterEach(async () => {
		await app.close()
	})

	test('the tcp service accepts commands and replies', async () => {
		const port = 21000 + Math.floor(Math.random() * 20000)
		app.registry.userconfig.setKey('tcp_listen_port', port)
		app.registry.userconfig.setKey('tcp_enabled', true)

		app.createCustomVariable('tcp_var', 'initial')

		const controlId = app.createButton({ pageNumber: 1, row: 1, column: 1 })
		app.addInternalAction(controlId, 'custom_variable_set_value', {
			name: exprVal('tcp_var'),
			create: exprVal(false),
			value: exprVal('pressed-over-tcp'),
		})

		const socket = await connectTcp(port)
		try {
			const lines = collectLines(socket)

			// Set and read back a custom variable
			socket.write('custom-variable tcp_var set-value hello-tcp\n')
			await vi.waitFor(() => {
				expect(lines()).toEqual(['+OK'])
			})
			expect(app.getCustomVariableValue('tcp_var')).toBe('hello-tcp')

			// get-value replies with the json-encoded value
			socket.write('custom-variable tcp_var get-value\n')
			await vi.waitFor(() => {
				expect(lines()).toEqual(['+OK', '+OK "hello-tcp"'])
			})

			// Press a button by location
			socket.write('location 1/1/1 press\n')
			await vi.waitFor(() => {
				expect(app.getCustomVariableValue('tcp_var')).toBe('pressed-over-tcp')
			})

			// An unknown command is rejected
			socket.write('nonsense command\n')
			await vi.waitFor(() => {
				expect(lines().at(-1)).toMatch(/^-ERR/)
			})
		} finally {
			socket.destroy()
		}
	})

	test('disabling the tcp service closes the socket', async () => {
		const port = 21000 + Math.floor(Math.random() * 20000)
		app.registry.userconfig.setKey('tcp_listen_port', port)
		app.registry.userconfig.setKey('tcp_enabled', true)

		const socket = await connectTcp(port)
		socket.destroy()

		app.registry.userconfig.setKey('tcp_enabled', false)

		// New connections are refused once the service has shut down
		await vi.waitFor(async () => {
			await expect(tryConnectTcp(port)).rejects.toThrow()
		})
	})

	test('the udp service processes datagrams', async () => {
		const port = 21000 + Math.floor(Math.random() * 20000)
		app.registry.userconfig.setKey('udp_listen_port', port)
		app.registry.userconfig.setKey('udp_enabled', true)

		app.createCustomVariable('udp_var', 'initial')

		const socket = dgram.createSocket('udp4')
		try {
			// The service binds on a userconfig fanout tick, so retry until the datagram lands
			await vi.waitFor(
				() => {
					socket.send(Buffer.from('custom-variable udp_var set-value hello-udp'), port, '127.0.0.1')
					expect(app.getCustomVariableValue('udp_var')).toBe('hello-udp')
				},
				{ timeout: 5000, interval: 200 }
			)
		} finally {
			socket.close()
		}
	})
})
