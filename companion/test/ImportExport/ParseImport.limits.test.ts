import zlib from 'node:zlib'
import { describe, expect, test, vi } from 'vitest'

// Shrink the size limits so the "too large" branches can be exercised without allocating hundreds of
// megabytes. Round-trip behaviour for normal (small) data is covered in ParseImport.test.ts.
vi.mock('../../lib/ImportExport/Constants.js', () => ({
	FILE_VERSION: 12,
	MAX_IMPORT_FILE_SIZE: 1000,
	MAX_DECOMPRESSED_FILE_SIZE: 1000,
	MAX_STREAMED_DECOMPRESSED_FILE_SIZE: 1000,
}))

const { parseImportBuffer } = await import('../../lib/ImportExport/ParseImport.js')

describe('parseImportBuffer size limits', () => {
	test('plain JSON larger than the streaming cap is rejected as too large', async () => {
		const big = Buffer.from(JSON.stringify({ big: 'x'.repeat(5000) }))
		const result = await parseImportBuffer(big)
		expect(result.data).toBeNull()
		expect(result.error).toBe('File is too large')
	})

	test('gzipped JSON that decompresses past the streaming cap is rejected as too large', async () => {
		const gz = zlib.gzipSync(Buffer.from(JSON.stringify({ big: 'x'.repeat(5000) })))
		// The compressed size is tiny, but the decompressed size exceeds the cap.
		expect(gz.length).toBeLessThan(1000)
		const result = await parseImportBuffer(gz)
		expect(result.data).toBeNull()
		expect(result.error).toBe('File is too large')
	})

	test('YAML larger than the string limit is rejected with a JSON-suggesting message', async () => {
		const big = Buffer.from('data: ' + 'x'.repeat(5000))
		const result = await parseImportBuffer(big)
		expect(result.data).toBeNull()
		expect(result.error).toBe('This file is too large to import as YAML. Please re-export it as JSON and try again.')
	})
})
