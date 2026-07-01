import { describe, expect, test } from 'vitest'
import { encodeFrame, FrameDecoder } from '../../lib/Instance/Common/MessageFraming.js'

describe('MessageFraming', () => {
	test('encodeFrame reports the exact JSON byte length', () => {
		const message = { direction: 'call', name: 'hello', payload: { a: 1 }, callbackId: 5 }
		const { frame, bodyBytes } = encodeFrame(message)

		const expected = Buffer.byteLength(JSON.stringify(message), 'utf8')
		expect(bodyBytes).toBe(expected)
		// frame = 4-byte header + body
		expect(frame.length).toBe(4 + expected)
		expect(frame.readUInt32BE(0)).toBe(expected)
	})

	test('round-trips a single frame', () => {
		const message = { direction: 'response', callbackId: 1, success: true, payload: 'ok' }
		const { frame, bodyBytes } = encodeFrame(message)

		const decoder = new FrameDecoder()
		const out = decoder.push(frame)
		expect(out).toHaveLength(1)
		expect(out[0].message).toEqual(message)
		expect(out[0].bodyBytes).toBe(bodyBytes)
	})

	test('decodes multiple frames coalesced into one chunk', () => {
		const a = encodeFrame({ n: 1 })
		const b = encodeFrame({ n: 2 })
		const c = encodeFrame({ n: 3 })

		const decoder = new FrameDecoder()
		const out = decoder.push(Buffer.concat([a.frame, b.frame, c.frame]))
		expect(out.map((f) => f.message)).toEqual([{ n: 1 }, { n: 2 }, { n: 3 }])
	})

	test('reassembles a frame split across many chunks (incl. a split header)', () => {
		const message = { payload: 'x'.repeat(1000) }
		const { frame, bodyBytes } = encodeFrame(message)

		const decoder = new FrameDecoder()
		const collected = []
		// Feed one byte at a time - exercises partial header and partial body
		for (const byte of frame) {
			collected.push(...decoder.push(Buffer.from([byte])))
		}
		expect(collected).toHaveLength(1)
		expect(collected[0].message).toEqual(message)
		expect(collected[0].bodyBytes).toBe(bodyBytes)
	})

	test('handles a large (multi-hundred-KB) payload like a drawControls image', () => {
		const message = { direction: 'call', name: 'drawControls', payload: { image: 'A'.repeat(300_000) } }
		const { frame, bodyBytes } = encodeFrame(message)
		expect(bodyBytes).toBeGreaterThan(300_000)

		const decoder = new FrameDecoder()
		// split into arbitrary 64KB-ish chunks
		const out = []
		for (let i = 0; i < frame.length; i += 64_000) {
			out.push(...decoder.push(frame.subarray(i, i + 64_000)))
		}
		expect(out).toHaveLength(1)
		expect(out[0].message).toEqual(message)
		expect(out[0].bodyBytes).toBe(bodyBytes)
	})
})
