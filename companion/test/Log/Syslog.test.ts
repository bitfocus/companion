/**
 * These exercise @logtape/syslog, to guard the local patch which stops it from producing an unhandled rejection
 * (and never recovering) when the syslog server can't be reached, and from buffering without limit
 */
import dgram from 'node:dgram'
import net from 'node:net'
import { setTimeout as delay } from 'node:timers/promises'
import type { LogRecord } from '@logtape/logtape'
import { getSyslogSink } from '@logtape/syslog'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

function makeRecord(message: string): LogRecord {
	return {
		category: ['companion'],
		level: 'warning',
		message: [message],
		rawMessage: message,
		timestamp: Date.now(),
		properties: { source: 'Test' },
	}
}

async function waitFor(check: () => boolean): Promise<void> {
	for (let i = 0; i < 100 && !check(); i++) await delay(20)
}

async function getFreePort(): Promise<number> {
	const server = net.createServer()
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
	const port = (server.address() as net.AddressInfo).port
	await new Promise((resolve) => server.close(resolve))
	return port
}

describe('syslog sink', () => {
	const unhandled: unknown[] = []
	const onUnhandled = (reason: unknown) => unhandled.push(reason)

	beforeEach(() => {
		unhandled.length = 0
		process.on('unhandledRejection', onUnhandled)
	})
	afterEach(() => {
		process.off('unhandledRejection', onUnhandled)
	})

	test('sends over udp', async () => {
		const socket = dgram.createSocket('udp4')
		const received: string[] = []
		socket.on('message', (msg) => received.push(msg.toString()))
		await new Promise<void>((resolve) => socket.bind(0, '127.0.0.1', resolve))

		const sink = getSyslogSink({
			hostname: '127.0.0.1',
			port: socket.address().port,
			appName: 'Companion',
			syslogHostname: 'my-host',
		})
		try {
			sink(makeRecord('hello udp'))
			await waitFor(() => received.length > 0)

			expect(received).toHaveLength(1)
			// <PRI>VERSION TIMESTAMP HOSTNAME APP-NAME PROCID MSGID STRUCTURED-DATA MSG, local0 + warning = 132
			expect(received[0]).toMatch(/^<132>1 \S+ my-host Companion \d+ - - hello udp$/)
		} finally {
			await sink[Symbol.asyncDispose]()
			socket.close()
		}
	})

	test('tcp recovers once the server becomes reachable', async () => {
		const port = await getFreePort()
		const sink = getSyslogSink({ hostname: '127.0.0.1', port, protocol: 'tcp', timeout: 500 })

		let server: net.Server | undefined
		try {
			// Nothing is listening yet
			sink(makeRecord('lost 1'))
			sink(makeRecord('lost 2'))
			await delay(200)

			let received = ''
			server = net.createServer((conn) => conn.on('data', (data) => (received += data.toString())))
			await new Promise<void>((resolve) => server!.listen(port, '127.0.0.1', resolve))

			sink(makeRecord('delivered'))
			await waitFor(() => received.includes('delivered'))

			expect(received).toContain('delivered')
			expect(received).not.toContain('lost')
			expect(unhandled).toEqual([])
		} finally {
			await sink[Symbol.asyncDispose]()
			server?.close()
		}
	})

	test('tcp reconnects after the server drops the connection', async () => {
		let received = ''
		const connections = new Set<net.Socket>()
		const server = net.createServer((conn) => {
			connections.add(conn)
			conn.on('data', (data) => (received += data.toString()))
		})
		await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
		const port = (server.address() as net.AddressInfo).port

		const sink = getSyslogSink({ hostname: '127.0.0.1', port, protocol: 'tcp', timeout: 500 })
		try {
			sink(makeRecord('first'))
			await waitFor(() => received.includes('first'))

			for (const conn of connections) conn.destroy()
			await delay(100)

			sink(makeRecord('second'))
			await waitFor(() => received.includes('second'))

			expect(received).toContain('second')
			expect(unhandled).toEqual([])
		} finally {
			await sink[Symbol.asyncDispose]()
			server.close()
		}
	})

	test('drops records once maxBufferedBytes is reached', async () => {
		let received = ''
		const server = net.createServer((conn) => conn.on('data', (data) => (received += data.toString())))
		await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
		const port = (server.address() as net.AddressInfo).port

		// Each record is around 60 bytes, so only the first few fit
		const sink = getSyslogSink({ hostname: '127.0.0.1', port, protocol: 'tcp', maxBufferedBytes: 200 })
		try {
			// Nothing is sent until the connection is made, so these all wait in the buffer
			for (let i = 0; i < 10; i++) sink(makeRecord(`record-${i}`))
			await waitFor(() => received.includes('record-0'))
			await delay(100)

			expect(received).toContain('record-0')
			expect(received).not.toContain('record-9')

			// Once the buffer has been sent, records are accepted again
			sink(makeRecord('later'))
			await waitFor(() => received.includes('later'))
			expect(received).toContain('later')
		} finally {
			await sink[Symbol.asyncDispose]()
			server.close()
		}
	})

	test('drops records queued before a failure, rather than connecting for each', async () => {
		const connectSpy = vi.spyOn(net.Socket.prototype, 'connect')
		const port = await getFreePort()
		const sink = getSyslogSink({ hostname: '127.0.0.1', port, protocol: 'tcp', timeout: 500 })
		try {
			// Nothing is listening, and these are all queued behind the first connection attempt
			for (let i = 0; i < 10; i++) sink(makeRecord(`lost-${i}`))
			await delay(200)
			expect(connectSpy).toHaveBeenCalledTimes(1)

			// A record logged after the failure tries again
			sink(makeRecord('retry'))
			await delay(200)
			expect(connectSpy).toHaveBeenCalledTimes(2)
			expect(unhandled).toEqual([])
		} finally {
			await sink[Symbol.asyncDispose]()
			connectSpy.mockRestore()
		}
	})
})
