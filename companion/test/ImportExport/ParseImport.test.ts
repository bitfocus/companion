import zlib from 'node:zlib'
import { describe, expect, test } from 'vitest'
import yaml from 'yaml'
import { parseImportBuffer, stripBomAndLooksLikeJson } from '../../lib/ImportExport/ParseImport.js'

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
})

// ── parseImportBuffer ─────────────────────────────────────────────────────────

describe('parseImportBuffer', () => {
	const sample = { type: 'full', version: 6, instances: { a: { label: 'A' } }, pages: { 1: { name: 'p1' } } }

	test('parses plain JSON', async () => {
		const result = await parseImportBuffer(Buffer.from(JSON.stringify(sample)))
		expect(result.error).toBeNull()
		expect(result.data).toEqual(sample)
	})

	test('parses tab-indented (pretty) JSON', async () => {
		const result = await parseImportBuffer(Buffer.from(JSON.stringify(sample, undefined, '\t')))
		expect(result.error).toBeNull()
		expect(result.data).toEqual(sample)
	})

	test('parses gzipped JSON', async () => {
		const gz = zlib.gzipSync(Buffer.from(JSON.stringify(sample)))
		const result = await parseImportBuffer(gz)
		expect(result.error).toBeNull()
		expect(result.data).toEqual(sample)
	})

	test('parses YAML', async () => {
		const result = await parseImportBuffer(Buffer.from(yaml.stringify(sample)))
		expect(result.error).toBeNull()
		expect(result.data).toEqual(sample)
	})

	test('a `{`-starting YAML flow map (invalid JSON) falls back to YAML', async () => {
		// Valid YAML flow-style map, but invalid JSON (unquoted keys/values)
		const result = await parseImportBuffer(Buffer.from('{ host: localhost, port: 8080 }'))
		expect(result.error).toBeNull()
		expect(result.data).toEqual({ host: 'localhost', port: 8080 })
	})

	test('a JSON export round-trips through gzip and back to an object', async () => {
		// Simulate an export -> import cycle for the gz format
		const gz = zlib.gzipSync(Buffer.from(JSON.stringify(sample)))
		const result = await parseImportBuffer(gz)
		expect(result.data).toEqual(sample)
	})

	test('a non-object scalar is rejected', async () => {
		const result = await parseImportBuffer(Buffer.from(JSON.stringify('just a string')))
		expect(result.data).toBeNull()
		expect(result.error).toBe('File is corrupted or unknown format')
	})

	test('an empty file is rejected', async () => {
		const result = await parseImportBuffer(Buffer.from(''))
		expect(result.data).toBeNull()
		expect(result.error).toBe('File is corrupted or unknown format')
	})

	test('malformed content is rejected', async () => {
		const result = await parseImportBuffer(Buffer.from('this: is: not: valid: yaml: [ {'))
		expect(result.data).toBeNull()
		expect(result.error).toBe('File is corrupted or unknown format')
	})
})
