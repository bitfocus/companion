import { afterEach, describe, expect, test, vi } from 'vitest'
import { createPairingNonce } from '../../lib/Link/Transports/Secure/Pairing.js'
import {
	acceptAuthentication,
	requestAuthentication,
	type PairingRequest,
} from '../../lib/Link/Transports/Secure/PairingSession.js'
import type { SecureChannel } from '../../lib/Link/Transports/Secure/SecureChannel.js'
import LogController from '../../lib/Log/Controller.js'
import { establishPair } from './helpers/MemoryPipe.js'

const logger = LogController.createLogger('test/PairingSession')

/** Run both ends of the authentication over a fresh channel */
async function authenticate(options: { acceptingRemembers: boolean; connectingPaired: boolean; maxPending?: number }) {
	const { connecting, accepting } = await establishPair()

	const requests: PairingRequest[] = []
	const acceptingHost = {
		logger,
		isPaired: vi.fn((linkId: string) => options.acceptingRemembers && linkId === connecting.identity.id),
		canRequestPairing: vi.fn(() => requests.length < (options.maxPending ?? 10)),
		requestPairing: vi.fn((request: PairingRequest) => {
			requests.push(request)
		}),
		trusted: vi.fn((_channel: SecureChannel, _newlyPaired: boolean) => {}),
	}
	const connectingHost = {
		logger,
		paired: options.connectingPaired,
		showCode: vi.fn((_code: string) => {}),
		trusted: vi.fn(() => {}),
		refused: vi.fn((_reason: 'rejected' | 'not-paired') => {}),
	}
	const acceptingClosed = vi.fn()
	accepting.channel.onClose(acceptingClosed)

	acceptAuthentication(accepting.channel, acceptingHost)
	requestAuthentication(connecting.channel, connectingHost)

	return { connecting, accepting, acceptingHost, connectingHost, requests, acceptingClosed }
}

/** Wait for the pairing request, and the code the connecting end shows */
async function waitForRequest(ctx: Awaited<ReturnType<typeof authenticate>>) {
	await vi.waitFor(() => expect(ctx.requests).toHaveLength(1))
	await vi.waitFor(() => expect(ctx.connectingHost.showCode).toHaveBeenCalled())
	return { request: ctx.requests[0], code: ctx.connectingHost.showCode.mock.calls[0][0] }
}

describe('pairing sessions', () => {
	afterEach(() => {
		vi.useRealTimers()
	})

	test('pair when the code the connecting end shows is entered on the accepting end', async () => {
		const ctx = await authenticate({ acceptingRemembers: false, connectingPaired: false })
		const { request, code } = await waitForRequest(ctx)
		expect(code).toMatch(/^\d{4}-\d{4}$/)
		expect(ctx.acceptingHost.trusted).not.toHaveBeenCalled()

		const ended = vi.fn()
		request.onEnd(ended)
		expect(request.enterCode(code)).toBe('paired')
		expect(ended).toHaveBeenCalled()
		expect(ctx.acceptingHost.trusted).toHaveBeenCalledWith(ctx.accepting.channel, true)
		await vi.waitFor(() => expect(ctx.connectingHost.trusted).toHaveBeenCalled())
	})

	test('trust each other straight away when both have paired', async () => {
		const ctx = await authenticate({ acceptingRemembers: true, connectingPaired: true })

		await vi.waitFor(() => expect(ctx.connectingHost.trusted).toHaveBeenCalled())
		expect(ctx.acceptingHost.trusted).toHaveBeenCalledWith(ctx.accepting.channel, false)
		expect(ctx.acceptingHost.requestPairing).not.toHaveBeenCalled()
		expect(ctx.connectingHost.showCode).not.toHaveBeenCalled()
	})

	test('pair again when the connecting end has forgotten, although the accepting end remembers it', async () => {
		const ctx = await authenticate({ acceptingRemembers: true, connectingPaired: false })
		await waitForRequest(ctx)
		expect(ctx.acceptingHost.trusted).not.toHaveBeenCalled()
	})

	test('a wrong code is refused, and too many reject the request', async () => {
		const ctx = await authenticate({ acceptingRemembers: false, connectingPaired: false })
		const { request } = await waitForRequest(ctx)

		expect(request.enterCode('0000-0000')).toBe('wrong')
		expect(request.enterCode('0000-0000')).toBe('wrong')
		expect(request.enterCode('0000-0000')).toBe('rejected')
		await vi.waitFor(() => expect(ctx.connectingHost.refused).toHaveBeenCalledWith('rejected'))
		expect(ctx.acceptingHost.trusted).not.toHaveBeenCalled()
	})

	test('rejecting a request tells the connecting end', async () => {
		const ctx = await authenticate({ acceptingRemembers: false, connectingPaired: false })
		const { request } = await waitForRequest(ctx)

		request.reject()
		await vi.waitFor(() => expect(ctx.connectingHost.refused).toHaveBeenCalledWith('rejected'))
		expect(request.enterCode('0000-0000')).toBe('rejected')
	})

	test('a pairing request is refused while too many are waiting', async () => {
		const ctx = await authenticate({ acceptingRemembers: false, connectingPaired: false, maxPending: 0 })

		await vi.waitFor(() => expect(ctx.connectingHost.refused).toHaveBeenCalledWith('rejected'))
		expect(ctx.acceptingHost.requestPairing).not.toHaveBeenCalled()
	})

	test('the connecting end refuses an end that claims to be paired with it when it never was', async () => {
		const { connecting, accepting } = await establishPair()
		const host = {
			logger,
			paired: false,
			showCode: vi.fn(),
			trusted: vi.fn(),
			refused: vi.fn(),
		}
		requestAuthentication(connecting.channel, host)

		// An impostor, rather than acceptAuthentication
		accepting.channel.send(JSON.stringify({ op: 'auth', status: 'paired' }))
		await vi.waitFor(() => expect(host.refused).toHaveBeenCalledWith('not-paired'))
		expect(host.trusted).not.toHaveBeenCalled()
	})

	test('the connecting end closes the channel when the revealed nonce does not match its commitment', async () => {
		const { connecting, accepting } = await establishPair()
		const host = { logger, paired: false, showCode: vi.fn(), trusted: vi.fn(), refused: vi.fn() }
		const closed = vi.fn()
		connecting.channel.onClose(closed)
		requestAuthentication(connecting.channel, host)

		// An end that commits to one nonce, then reveals another, as one choosing its nonce late would
		accepting.channel.setHandler((text) => {
			if (JSON.parse(text).op === 'pairing-nonce') {
				accepting.channel.send(JSON.stringify({ op: 'pairing-reveal', nonce: createPairingNonce() }))
			}
		})
		accepting.channel.send(JSON.stringify({ op: 'pairing-commit', commit: createPairingNonce() }))

		await vi.waitFor(() => expect(closed).toHaveBeenCalled())
		expect(host.showCode).not.toHaveBeenCalled()
	})

	test('a request that waits too long is rejected', async () => {
		// Only timeouts are faked, so that the pipe still delivers
		vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
		const ctx = await authenticate({ acceptingRemembers: false, connectingPaired: false })
		const { request } = await waitForRequest(ctx)
		const ended = vi.fn()
		request.onEnd(ended)

		await vi.advanceTimersByTimeAsync(4 * 60 * 1000)
		expect(ended).not.toHaveBeenCalled()

		await vi.advanceTimersByTimeAsync(2 * 60 * 1000)
		expect(ended).toHaveBeenCalled()
		await vi.waitFor(() => expect(ctx.connectingHost.refused).toHaveBeenCalledWith('rejected'))
	})
})
