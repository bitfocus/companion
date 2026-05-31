import { describe, expect, test, vi } from 'vitest'
import type { ExportPageContentv6 } from '@companion-app/shared/Model/ExportModel.js'
import { find_smallest_grid_for_page, formatAttachmentFilename, stringifyExport } from '../../lib/ImportExport/Util.js'

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

// ── stringifyExport ───────────────────────────────────────────────────────────

describe('stringifyExport', () => {
	const logger = { warn: vi.fn() } as any
	const sampleData = { type: 'full', version: 6, instances: {}, pages: {} } as any
	const filename = 'my-export'

	test('format "json" returns tab-indented JSON string', async () => {
		const result = await stringifyExport(logger, sampleData, filename, 'json')
		expect(result).not.toBeNull()
		expect(typeof result!.data).toBe('string')
		expect(result!.data as string).toContain(JSON.stringify(sampleData, undefined, '\t'))
		expect(result!.asciiFilename).toBe(`"${filename}"`)
	})

	test('format "yaml" returns a YAML string', async () => {
		const result = await stringifyExport(logger, sampleData, filename, 'yaml')
		expect(result).not.toBeNull()
		expect(typeof result!.data).toBe('string')
		// YAML output contains the version number
		expect(result!.data as string).toContain('version: 6')
	})

	test('format "json-gz" returns a Buffer', async () => {
		const result = await stringifyExport(logger, sampleData, filename, 'json-gz')
		expect(result).not.toBeNull()
		expect(Buffer.isBuffer(result!.data)).toBe(true)
	})

	test('format undefined defaults to gzip (returns a Buffer)', async () => {
		const result = await stringifyExport(logger, sampleData, filename, undefined)
		expect(result).not.toBeNull()
		expect(Buffer.isBuffer(result!.data)).toBe(true)
	})

	test('unknown format returns null', async () => {
		const result = await stringifyExport(logger, sampleData, filename, 'unknown-format' as any)
		expect(result).toBeNull()
	})

	test('both json-gz and json produce the correct filename fields', async () => {
		const result = await stringifyExport(logger, sampleData, 'café-export', 'json')
		expect(result!.asciiFilename).toBe('"cafe-export"')
		expect(result!.utf8Filename).toBe('caf%C3%A9-export')
	})
})
