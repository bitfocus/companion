import zlib from 'node:zlib'
import { describe, expect, test, vi } from 'vitest'
import type { ParseImportResult } from '../../lib/ImportExport/ParseImport.js'

// Shrink the streaming size cap so the "too large" JSON branch can be exercised without allocating
// gigabytes. Round-trip behaviour for normal (small) data is covered in ParseImport.test.ts, and
// oversized-YAML rejection in ThreadMethods.test.ts.
vi.mock('../../lib/ImportExport/Constants.js', () => ({
	FILE_VERSION: 12,
	MAX_IMPORT_FILE_SIZE: 1000,
	MAX_DECOMPRESSED_FILE_SIZE: 1000,
	MAX_STREAMED_DECOMPRESSED_FILE_SIZE: 1000,
}))

const { parseImportBuffer } = await import('../../lib/ImportExport/ParseImport.js')

// The JSON "too large" cases are rejected before any YAML fallback, so this must never be called.
const parseYaml = async (): Promise<ParseImportResult> => {
	throw new Error('parseYaml should not be called for oversized JSON')
}

describe('parseImportBuffer streaming size limits', () => {
	test('plain JSON larger than the streaming cap is rejected as too large', async () => {
		const big = Buffer.from(JSON.stringify({ big: 'x'.repeat(5000) }))
		const result = await parseImportBuffer(big, parseYaml)
		expect(result.data).toBeNull()
		expect(result.error).toBe('File is too large')
	})

	test('gzipped JSON that decompresses past the streaming cap is rejected as too large', async () => {
		const gz = zlib.gzipSync(Buffer.from(JSON.stringify({ big: 'x'.repeat(5000) })))
		// The compressed size is tiny, but the decompressed size exceeds the cap.
		expect(gz.length).toBeLessThan(1000)
		const result = await parseImportBuffer(gz, parseYaml)
		expect(result.data).toBeNull()
		expect(result.error).toBe('File is too large')
	})
})
