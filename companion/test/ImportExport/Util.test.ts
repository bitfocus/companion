import { Writable } from 'node:stream'
import zlib from 'node:zlib'
import { describe, expect, test, vi } from 'vitest'
import yaml from 'yaml'
import type { ExportPageContentv6 } from '@companion-app/shared/Model/ExportModel.js'
import {
	ExportTooLargeError,
	find_smallest_grid_for_page,
	formatAttachmentFilename,
	prepareExport,
	streamExport,
} from '../../lib/ImportExport/Util.js'

/** A Writable that collects everything written to it, for asserting on streamed output. */
class CollectingWritable extends Writable {
	readonly #chunks: Buffer[] = []
	_write(chunk: Buffer, _encoding: BufferEncoding, callback: (error?: Error | null) => void): void {
		this.#chunks.push(Buffer.from(chunk))
		callback()
	}
	get collected(): Buffer {
		return Buffer.concat(this.#chunks)
	}
}

// ── formatAttachmentFilename ──────────────────────────────────────────────────

describe('formatAttachmentFilename', () => {
	test('ASCII-only filename is unchanged in both outputs', () => {
		const { asciiFilename, utf8Filename } = formatAttachmentFilename('export.json')
		expect(asciiFilename).toBe('"export.json"')
		expect(utf8Filename).toBe('export.json')
	})

	test('non-ASCII characters are stripped from asciiFilename', () => {
		// 'café' → NFKD splits 'é' into 'e' + combining accent (filtered out)
		const { asciiFilename } = formatAttachmentFilename('café.json')
		expect(asciiFilename).toBe('"cafe.json"')
	})

	test('non-ASCII characters are percent-encoded in utf8Filename', () => {
		const { utf8Filename } = formatAttachmentFilename('café.json')
		expect(utf8Filename).toBe(encodeURIComponent('café.json'))
	})

	test('double-quote in filename is backslash-escaped in asciiFilename', () => {
		const { asciiFilename } = formatAttachmentFilename('say "hi".txt')
		expect(asciiFilename).toBe('"say \\"hi\\".txt"')
	})

	test('backslash in filename is backslash-escaped', () => {
		const { asciiFilename } = formatAttachmentFilename('a\\b.json')
		expect(asciiFilename).toBe('"a\\\\b.json"')
	})

	test('empty string produces empty quoted and encoded result', () => {
		const { asciiFilename, utf8Filename } = formatAttachmentFilename('')
		expect(asciiFilename).toBe('""')
		expect(utf8Filename).toBe('')
	})

	test('characters outside printable ASCII (0x20-0x7e) are filtered', () => {
		// Control character \x01 is outside range
		const { asciiFilename } = formatAttachmentFilename('file\x01name.json')
		expect(asciiFilename).toBe('"filename.json"')
	})

	test('spaces are kept (0x20 is the lower bound)', () => {
		const { asciiFilename, utf8Filename } = formatAttachmentFilename('my file.json')
		expect(asciiFilename).toBe('"my file.json"')
		expect(utf8Filename).toBe('my%20file.json')
	})
})

// ── find_smallest_grid_for_page ───────────────────────────────────────────────

describe('find_smallest_grid_for_page', () => {
	test('empty controls returns the full 8x4 default grid', () => {
		const page: ExportPageContentv6 = {
			name: 'test',
			controls: {},
			gridSize: { minColumn: 0, maxColumn: 7, minRow: 0, maxRow: 3 },
		}
		expect(find_smallest_grid_for_page(page)).toEqual({ minColumn: 0, maxColumn: 7, minRow: 0, maxRow: 3 })
	})

	test('control within default bounds keeps default grid', () => {
		const page: ExportPageContentv6 = {
			name: 'test',
			controls: { 2: { 5: { type: 'button' } } },
			gridSize: { minColumn: 0, maxColumn: 7, minRow: 0, maxRow: 3 },
		}
		expect(find_smallest_grid_for_page(page)).toEqual({ minColumn: 0, maxColumn: 7, minRow: 0, maxRow: 3 })
	})

	test('control beyond default column bound expands maxColumn', () => {
		const page: ExportPageContentv6 = {
			name: 'test',
			controls: { 1: { 10: { type: 'button' } } },
			gridSize: { minColumn: 0, maxColumn: 7, minRow: 0, maxRow: 3 },
		}
		expect(find_smallest_grid_for_page(page).maxColumn).toBe(10)
	})

	test('control beyond default row bound expands maxRow', () => {
		const page: ExportPageContentv6 = {
			name: 'test',
			controls: { 5: { 0: { type: 'button' } } },
			gridSize: { minColumn: 0, maxColumn: 7, minRow: 0, maxRow: 3 },
		}
		expect(find_smallest_grid_for_page(page).maxRow).toBe(5)
	})

	test('null/falsy control value is skipped (does not affect row bounds)', () => {
		const page: ExportPageContentv6 = {
			name: 'test',
			controls: { 8: { 0: null as any } },
			gridSize: { minColumn: 0, maxColumn: 7, minRow: 0, maxRow: 3 },
		}
		// row 8 has only a null control → foundControl=false → row bounds not updated
		expect(find_smallest_grid_for_page(page).maxRow).toBe(3)
	})

	test('controls on multiple rows all update bounds', () => {
		const page: ExportPageContentv6 = {
			name: 'test',
			controls: {
				0: { 0: { type: 'button' } },
				6: { 9: { type: 'button' } },
			},
			gridSize: { minColumn: 0, maxColumn: 7, minRow: 0, maxRow: 3 },
		}
		const result = find_smallest_grid_for_page(page)
		expect(result.maxRow).toBe(6)
		expect(result.maxColumn).toBe(9)
	})
})

// ── prepareExport ─────────────────────────────────────────────────────────────

describe('prepareExport', () => {
	const sampleData = { type: 'full', version: 6, instances: {}, pages: {} } as any

	test('format "json" returns a tab-indented JSON buffer result', () => {
		const result = prepareExport(sampleData, 'json')
		expect(result).toEqual({ kind: 'buffer', data: JSON.stringify(sampleData, undefined, '\t') })
	})

	test('format "yaml" returns a YAML buffer result', () => {
		const result = prepareExport(sampleData, 'yaml')
		expect(result.kind).toBe('buffer')
		expect((result as { data: string }).data).toContain('version: 6')
	})

	test('format "json-gz" streams', () => {
		expect(prepareExport(sampleData, 'json-gz')).toEqual({ kind: 'stream', format: 'json-gz' })
	})

	test('undefined format defaults to streaming json-gz', () => {
		expect(prepareExport(sampleData, undefined)).toEqual({ kind: 'stream', format: 'json-gz' })
	})

	test('json falls back to streaming when it exceeds the string limit', () => {
		const spy = vi.spyOn(JSON, 'stringify').mockImplementationOnce(() => {
			throw new RangeError('Invalid string length')
		})
		try {
			expect(prepareExport(sampleData, 'json')).toEqual({ kind: 'stream', format: 'json' })
		} finally {
			spy.mockRestore()
		}
	})

	test('yaml rejects with ExportTooLargeError when it exceeds the string limit', () => {
		const spy = vi.spyOn(yaml, 'stringify').mockImplementationOnce(() => {
			throw new RangeError('Invalid string length')
		})
		try {
			expect(() => prepareExport(sampleData, 'yaml')).toThrow(ExportTooLargeError)
		} finally {
			spy.mockRestore()
		}
	})
})

// ── streamExport ──────────────────────────────────────────────────────────────

describe('streamExport', () => {
	const sampleData = { type: 'full', version: 6, instances: {}, pages: { 1: { name: 'p1' } } } as any

	test('json produces compact JSON that round-trips to the original', async () => {
		const dest = new CollectingWritable()
		const byteCount = await streamExport(sampleData, 'json', dest)

		const text = dest.collected.toString('utf-8')
		expect(JSON.parse(text)).toEqual(sampleData)
		// Compact output - no pretty-print indentation
		expect(text).not.toContain('\n')
		expect(text).not.toContain('\t')
		// The returned count matches the bytes actually written
		expect(byteCount).toBe(dest.collected.length)
	})

	test('json-gz produces gzip that gunzips back to the original', async () => {
		const dest = new CollectingWritable()
		const byteCount = await streamExport(sampleData, 'json-gz', dest)

		const gz = dest.collected
		// gzip magic bytes
		expect(gz[0]).toBe(0x1f)
		expect(gz[1]).toBe(0x8b)

		const text = zlib.gunzipSync(gz).toString('utf-8')
		expect(JSON.parse(text)).toEqual(sampleData)
		// The returned count matches the compressed bytes written
		expect(byteCount).toBe(gz.length)
	})
})
