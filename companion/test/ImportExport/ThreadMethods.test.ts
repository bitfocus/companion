import { promisify } from 'node:util'
import zlib from 'node:zlib'
import { describe, expect, test } from 'vitest'
import { ImportExportThreadMethods } from '../../lib/ImportExport/ThreadMethods.js'

const { parseImportData } = ImportExportThreadMethods

const gzipAsync = promisify(zlib.gzip)

// ── Test helpers ──────────────────────────────────────────────────────────────

/** Encode a string as an ArrayBuffer, the way the main thread transfers it to the worker */
function toArrayBuffer(str: string): ArrayBuffer {
	const buf = Buffer.from(str, 'utf-8')
	return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
}

async function gzipToArrayBuffer(str: string): Promise<ArrayBuffer> {
	const buf = await gzipAsync(Buffer.from(str, 'utf-8'))
	return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
}

const SAMPLE_EXPORT = { version: 6, type: 'full', someKey: 'someValue' }

// ── parseImportData ─────────────────────────────────────────────────────────────

describe('parseImportData', () => {
	describe('uncompressed input', () => {
		test('parses a plain JSON object', async () => {
			const result = await parseImportData(toArrayBuffer(JSON.stringify(SAMPLE_EXPORT)))

			expect(result.error).toBeNull()
			expect(result.data).toEqual(SAMPLE_EXPORT)
		})

		test('parses YAML (JSON is handled by the YAML parser too)', async () => {
			const yamlStr = 'version: 6\ntype: full\nsomeKey: someValue\n'
			const result = await parseImportData(toArrayBuffer(yamlStr))

			expect(result.error).toBeNull()
			expect(result.data).toEqual(SAMPLE_EXPORT)
		})

		test('parses a nested structure', async () => {
			const obj = { version: 6, instances: { abc: { label: 'x', moduleId: 'mod' } }, pages: { 1: { name: 'p' } } }
			const result = await parseImportData(toArrayBuffer(JSON.stringify(obj)))

			expect(result.error).toBeNull()
			expect(result.data).toEqual(obj)
		})
	})

	describe('gzip-compressed input', () => {
		test('transparently gunzips and parses a compressed object', async () => {
			const result = await parseImportData(await gzipToArrayBuffer(JSON.stringify(SAMPLE_EXPORT)))

			expect(result.error).toBeNull()
			expect(result.data).toEqual(SAMPLE_EXPORT)
		})

		test('gunzips compressed YAML', async () => {
			const result = await parseImportData(await gzipToArrayBuffer('version: 6\ntype: full\n'))

			expect(result.error).toBeNull()
			expect(result.data).toEqual({ version: 6, type: 'full' })
		})
	})

	describe('parse failures', () => {
		test('returns an error for syntactically invalid YAML', async () => {
			// Unterminated flow mapping - the YAML parser throws on this
			const result = await parseImportData(toArrayBuffer('{ a: '))

			expect(result.error).toBe('File is corrupted or unknown format')
			expect(result.data).toBeNull()
		})

		test('returns an error (not a crash) for an empty file', async () => {
			// Regression: yaml.parse('') returns null, which used to pass through as `data: null`
			// and crash the downstream upgradeImport (`null.version`).
			const result = await parseImportData(toArrayBuffer(''))

			expect(result.error).toBe('File is corrupted or unknown format')
			expect(result.data).toBeNull()
		})

		test('returns an error for plain text that YAML parses as a bare string', async () => {
			const result = await parseImportData(toArrayBuffer('this is just some text'))

			expect(result.error).toBe('File is corrupted or unknown format')
			expect(result.data).toBeNull()
		})

		test('returns an error for input that parses to a bare number', async () => {
			const result = await parseImportData(toArrayBuffer('42'))

			expect(result.error).toBe('File is corrupted or unknown format')
			expect(result.data).toBeNull()
		})

		test('returns an error for the literal "null"', async () => {
			const result = await parseImportData(toArrayBuffer('null'))

			expect(result.error).toBe('File is corrupted or unknown format')
			expect(result.data).toBeNull()
		})

		test('treats undecompressable binary as raw bytes (no gzip header)', async () => {
			// Random bytes that are not gzip and not valid structured data. gunzip fails (falls back to
			// raw), and YAML parses the bytes as a scalar string -> rejected as not-an-object.
			const buf = Buffer.from([0x00, 0x01, 0x02, 0xff, 0xfe])
			const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
			const result = await parseImportData(ab)

			expect(result.error).toBe('File is corrupted or unknown format')
			expect(result.data).toBeNull()
		})
	})

	describe('timing metadata', () => {
		test('populates a monotonic-ish timing block on success', async () => {
			const { timing } = await parseImportData(toArrayBuffer(JSON.stringify(SAMPLE_EXPORT)))

			expect(timing.workerEndTime).toBeGreaterThanOrEqual(timing.workerStartTime)
			expect(timing.gunzipEndTime).toBeGreaterThanOrEqual(timing.gunzipStartTime)
			expect(timing.parseEndTime).toBeGreaterThanOrEqual(timing.parseStartTime)
			expect(timing.workerEndTime).toBeGreaterThanOrEqual(timing.parseEndTime)
		})

		test('populates the timing block on parse failure too', async () => {
			const { timing } = await parseImportData(toArrayBuffer('{ a: '))

			expect(timing.workerEndTime).toBeGreaterThanOrEqual(timing.workerStartTime)
			expect(timing.parseEndTime).toBeGreaterThanOrEqual(timing.parseStartTime)
		})
	})
})
