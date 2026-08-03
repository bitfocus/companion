import zlib from 'node:zlib'
import { describe, expect, test, vi } from 'vitest'
import yaml from 'yaml'

// Shrink the string-limit cap so the "too large" branch can be exercised without allocating
// hundreds of megabytes.
vi.mock('../../lib/ImportExport/Constants.js', () => ({
	FILE_VERSION: 12,
	MAX_IMPORT_FILE_SIZE: 1000,
	MAX_DECOMPRESSED_FILE_SIZE: 1000,
	MAX_STREAMED_DECOMPRESSED_FILE_SIZE: 1000,
}))

const { ImportExportThreadMethods } = await import('../../lib/ImportExport/ThreadMethods.js')
const { parseImportData } = ImportExportThreadMethods

const toArrayBuffer = (buffer: Buffer): ArrayBuffer =>
	buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer

describe('parseImportData (worker YAML parser)', () => {
	const sample = { type: 'full', version: 6, instances: {} }

	test('parses plain YAML', async () => {
		const result = await parseImportData(toArrayBuffer(Buffer.from(yaml.stringify(sample))), false)
		expect(result.error).toBeNull()
		expect(result.data).toEqual(sample)
	})

	test('parses JSON (the YAML parser is a JSON superset)', async () => {
		const result = await parseImportData(toArrayBuffer(Buffer.from(JSON.stringify(sample))), false)
		expect(result.error).toBeNull()
		expect(result.data).toEqual(sample)
	})

	test('parses gzipped YAML', async () => {
		const gz = zlib.gzipSync(Buffer.from(yaml.stringify(sample)))
		const result = await parseImportData(toArrayBuffer(gz), true)
		expect(result.error).toBeNull()
		expect(result.data).toEqual(sample)
	})

	test('a non-object scalar is rejected', async () => {
		const result = await parseImportData(toArrayBuffer(Buffer.from('just a string')), false)
		expect(result.data).toBeNull()
		expect(result.error).toBe('File is corrupted or unknown format')
	})

	test('an empty file is rejected', async () => {
		const result = await parseImportData(toArrayBuffer(Buffer.from('')), false)
		expect(result.data).toBeNull()
		expect(result.error).toBe('File is corrupted or unknown format')
	})

	test('a plain file larger than the string limit is rejected with a JSON-suggesting message', async () => {
		const big = Buffer.from('data: ' + 'x'.repeat(5000))
		const result = await parseImportData(toArrayBuffer(big), false)
		expect(result.data).toBeNull()
		expect(result.error).toBe('This file is too large to import as YAML. Please re-export it as JSON and try again.')
	})

	test('gzipped data that decompresses past the string limit is rejected as too large', async () => {
		const gz = zlib.gzipSync(Buffer.from('data: ' + 'x'.repeat(5000)))
		const result = await parseImportData(toArrayBuffer(gz), true)
		expect(result.data).toBeNull()
		expect(result.error).toBe('This file is too large to import as YAML. Please re-export it as JSON and try again.')
	})
})
