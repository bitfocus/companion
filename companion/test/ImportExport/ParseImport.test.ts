import zlib from 'node:zlib'
import { describe, expect, test } from 'vitest'
import yaml from 'yaml'
import { parseImportBuffer, stripBomAndLooksLikeJson } from '../../lib/ImportExport/ParseImport.js'
import { ImportExportThreadMethods } from '../../lib/ImportExport/ThreadMethods.js'

// The real YAML path runs in a worker via ImportExportThreadMethods.parseImportData. Call it inline
// (no worker spawn) so the JSON-vs-YAML routing is exercised end-to-end against the actual parser.
const parseYaml = async (buffer: Buffer, gz: boolean) =>
	ImportExportThreadMethods.parseImportData(
		buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer,
		gz
	)

// ── stripBomAndLooksLikeJson ──────────────────────────────────────────────────

describe('stripBomAndLooksLikeJson', () => {
	test('plain object start is detected', () => {
		expect(stripBomAndLooksLikeJson('{"a":1}')).toBe(true)
		expect(stripBomAndLooksLikeJson(Buffer.from('{"a":1}'))).toBe(true)
	})

	test('leading whitespace/newlines before the brace are skipped', () => {
		expect(stripBomAndLooksLikeJson('   \n\t {"a":1}')).toBe(true)
		expect(stripBomAndLooksLikeJson(Buffer.from('\r\n  {}'))).toBe(true)
	})

	test('a leading UTF-8 BOM is stripped', () => {
		expect(stripBomAndLooksLikeJson('﻿{"a":1}')).toBe(true)
		expect(stripBomAndLooksLikeJson(Buffer.from('﻿{"a":1}', 'utf-8'))).toBe(true)
	})

	test('YAML block style is not detected as JSON', () => {
		expect(stripBomAndLooksLikeJson('foo: bar\n')).toBe(false)
		expect(stripBomAndLooksLikeJson(Buffer.from('foo: bar\n'))).toBe(false)
	})

	test('arrays and empty input are not detected as JSON objects', () => {
		expect(stripBomAndLooksLikeJson('[1,2,3]')).toBe(false)
		expect(stripBomAndLooksLikeJson('')).toBe(false)
	})

	test('an all-whitespace prefix with more content is treated as JSON (inconclusive -> streaming)', () => {
		// More than 64 bytes of leading whitespace: the brace is beyond the inspected prefix, so we
		// can't classify it - prefer the streaming path (it falls back to YAML on a parse error).
		expect(stripBomAndLooksLikeJson(' '.repeat(65) + '{"a":1}')).toBe(true)
		expect(stripBomAndLooksLikeJson(Buffer.from(' '.repeat(65) + '{"a":1}'))).toBe(true)
	})

	test('an all-whitespace short input is not treated as JSON', () => {
		expect(stripBomAndLooksLikeJson('    ')).toBe(false)
		expect(stripBomAndLooksLikeJson(' '.repeat(64))).toBe(false)
	})
})

// ── parseImportBuffer ─────────────────────────────────────────────────────────

describe('parseImportBuffer', () => {
	const sample = { type: 'full', version: 6, instances: { a: { label: 'A' } }, pages: { 1: { name: 'p1' } } }

	test('parses plain JSON (main-thread streaming)', async () => {
		const result = await parseImportBuffer(Buffer.from(JSON.stringify(sample)), parseYaml)
		expect(result.error).toBeNull()
		expect(result.data).toEqual(sample)
	})

	test('parses tab-indented (pretty) JSON', async () => {
		const result = await parseImportBuffer(Buffer.from(JSON.stringify(sample, undefined, '\t')), parseYaml)
		expect(result.error).toBeNull()
		expect(result.data).toEqual(sample)
	})

	test('parses gzipped JSON (main-thread streaming)', async () => {
		const gz = zlib.gzipSync(Buffer.from(JSON.stringify(sample)))
		const result = await parseImportBuffer(gz, parseYaml)
		expect(result.error).toBeNull()
		expect(result.data).toEqual(sample)
	})

	test('parses YAML (via the injected worker parser)', async () => {
		const result = await parseImportBuffer(Buffer.from(yaml.stringify(sample)), parseYaml)
		expect(result.error).toBeNull()
		expect(result.data).toEqual(sample)
	})

	test('JSON with >64 bytes of leading whitespace stays on the streaming path (parseYaml not called)', async () => {
		let yamlCalls = 0
		const spyParseYaml = async (buffer: Buffer, gz: boolean) => {
			yamlCalls++
			return parseYaml(buffer, gz)
		}

		const padded = Buffer.from(' '.repeat(65) + JSON.stringify(sample))
		const result = await parseImportBuffer(padded, spyParseYaml)
		expect(result.error).toBeNull()
		expect(result.data).toEqual(sample)
		expect(yamlCalls).toBe(0)
	})

	test('a `{`-starting YAML flow map (invalid JSON) falls back to YAML', async () => {
		// Valid YAML flow-style map, but invalid JSON (unquoted keys/values)
		const result = await parseImportBuffer(Buffer.from('{ host: localhost, port: 8080 }'), parseYaml)
		expect(result.error).toBeNull()
		expect(result.data).toEqual({ host: 'localhost', port: 8080 })
	})

	test('a non-object scalar is rejected', async () => {
		const result = await parseImportBuffer(Buffer.from(JSON.stringify('just a string')), parseYaml)
		expect(result.data).toBeNull()
		expect(result.error).toBe('File is corrupted or unknown format')
	})

	test('an empty file is rejected', async () => {
		const result = await parseImportBuffer(Buffer.from(''), parseYaml)
		expect(result.data).toBeNull()
		expect(result.error).toBe('File is corrupted or unknown format')
	})

	test('malformed content is rejected', async () => {
		const result = await parseImportBuffer(Buffer.from('this: is: not: valid: yaml: [ {'), parseYaml)
		expect(result.data).toBeNull()
		expect(result.error).toBe('File is corrupted or unknown format')
	})
})
