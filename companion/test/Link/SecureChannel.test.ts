import { generateKeyPair } from 'noise-handshake/dh.js'
import { describe, expect, test, vi } from 'vitest'
import { LinkIdentity } from '../../lib/Link/Identity.js'
import { SecureChannel } from '../../lib/Link/Transports/Secure/SecureChannel.js'
import { createMemoryPipePair, establishPair } from './helpers/MemoryPipe.js'

describe('SecureChannel', () => {
	test('each end learns who the other is, proven in the handshake, and they share its hash', async () => {
		const { connecting, accepting } = await establishPair()

		expect(connecting.channel.remoteLinkId).toBe(accepting.identity.id)
		expect(connecting.channel.remoteName).toBe('Accepting')
		expect(accepting.channel.remoteLinkId).toBe(connecting.identity.id)
		expect(accepting.channel.remoteName).toBe('Connecting')
		expect(Buffer.from(connecting.channel.handshakeHash)).toEqual(Buffer.from(accepting.channel.handshakeHash))
	})

	test('carries messages both ways, splitting and reassembling large ones', async () => {
		const { connecting, accepting } = await establishPair()
		const receivedByAccepting: string[] = []
		const receivedByConnecting: string[] = []
		accepting.channel.setHandler((text) => receivedByAccepting.push(text))
		connecting.channel.setHandler((text) => receivedByConnecting.push(text))

		const large = 'x'.repeat(200_000)
		connecting.channel.send('hello')
		connecting.channel.send(large)
		accepting.channel.send('hi')

		await vi.waitFor(() => expect(receivedByAccepting).toEqual(['hello', large]))
		await vi.waitFor(() => expect(receivedByConnecting).toEqual(['hi']))
	})

	test('closes when a message has been tampered with', async () => {
		const { connecting, accepting } = await establishPair()
		const onClose = vi.fn()
		accepting.channel.onClose(onClose)
		accepting.channel.setHandler(() => {})

		connecting.pipe.tamper = (data) => {
			const copy = Buffer.from(data)
			copy[copy.length - 1] ^= 1
			return copy
		}
		connecting.channel.send('hello')

		await vi.waitFor(() => expect(onClose).toHaveBeenCalled())
	})

	test('fails when the other end does not answer in time', async () => {
		const [connecting] = createMemoryPipePair()
		await expect(
			SecureChannel.establish(connecting, true, generateKeyPair(), LinkIdentity.generate(), 'Connecting', 1024, 50)
		).rejects.toThrow(/timed out/)
	})
})
