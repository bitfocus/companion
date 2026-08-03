/*
 * This file is part of the Companion project
 * Copyright (c) 2018 Bitfocus AS
 * Authors: Julian Waller <git@julusian.co.uk>
 *
 * This program is free software.
 * You should have received a copy of the MIT licence as well as the Bitfocus
 * Individual Contributor License Agreement for companion along with
 * this program.
 */

import { Readable, Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import zlib from 'node:zlib'
import parser from 'stream-json'
import Assembler from 'stream-json/assembler.js'
import { MAX_STREAMED_DECOMPRESSED_FILE_SIZE } from './Constants.js'

/** Size of the slices fed into the streaming parser, so it yields between chunks instead of
 * blocking the event loop on one giant buffer. */
const IMPORT_CHUNK_SIZE = 1024 * 1024 // 1MiB

const TOO_LARGE_MESSAGE = 'File is too large'
const CORRUPTED_MESSAGE = 'File is corrupted or unknown format'

export interface ParseImportResult {
	error: string | null
	/** The parsed object, or null if parsing failed */
	data: unknown
}

/**
 * Parses a buffer as YAML. Injected into {@link parseImportBuffer} so the caller can run it off the
 * main thread: YAML has no streaming parser, and a large synchronous parse would block the event
 * loop (timing out connections). `gz` indicates whether the bytes are gzip compressed.
 */
export type ParseYamlFn = (buffer: Buffer, gz: boolean) => Promise<ParseImportResult>

/** Thrown by the byte-counting guard when the decompressed data exceeds the streaming size cap. */
class StreamTooLargeError extends Error {}

/**
 * Decide whether a buffer looks like JSON by checking whether the first non-whitespace character
 * (after stripping a UTF-8 BOM) is `{`. This is a *hint*, not a verdict: `{ host: localhost }` is a
 * valid YAML flow map but invalid JSON, so callers must fall back to YAML on a JSON parse error.
 */
export function stripBomAndLooksLikeJson(data: Buffer | string): boolean {
	// Only the very start matters. Decode a small prefix; the leading whitespace and first
	// meaningful character are always ASCII, so a truncated multi-byte tail is harmless.
	const prefix = typeof data === 'string' ? data.slice(0, 64) : data.subarray(0, 64).toString('utf-8')

	let i = 0
	// Strip a leading UTF-8 BOM (decodes to U+FEFF)
	if (prefix.charCodeAt(0) === 0xfeff) i = 1

	// Skip ASCII whitespace
	while (i < prefix.length) {
		const c = prefix[i]
		if (c === ' ' || c === '\t' || c === '\n' || c === '\r') {
			i++
			continue
		}
		break
	}

	return prefix[i] === '{'
}

/**
 * Parse an uploaded import file (already assembled into a Buffer on the main thread).
 *
 * JSON (plain or gz) is stream-parsed here on the main thread, so it is never materialised as a
 * single JS string (not bound by MAX_STRING_LENGTH) and there is no worker->main IPC copy. YAML -
 * which has no streaming parser - is handed to `parseYaml` (the caller runs it in a worker so a
 * large synchronous parse does not block the event loop).
 */
export async function parseImportBuffer(buffer: Buffer, parseYaml: ParseYamlFn): Promise<ParseImportResult> {
	// gzip magic bytes - a cheap check that avoids sniffing the content itself.
	const isGz = buffer.length >= 2 && buffer[0] === 0x1f && buffer[1] === 0x8b

	if (isGz) {
		// Companion's json-gz exports are JSON by construction, so stream-parse as JSON.
		try {
			const data = await streamParseJson(buffer, true)
			return validateParsedObject(data)
		} catch (e) {
			if (e instanceof StreamTooLargeError) return { error: TOO_LARGE_MESSAGE, data: null }
			// Not valid JSON (e.g. a hand-gzipped YAML file, which we never produce). Parse as YAML.
			return parseYaml(buffer, true)
		}
	}

	if (stripBomAndLooksLikeJson(buffer)) {
		// The leading `{` hints at JSON. Stream-parse as JSON, falling back to YAML on a parse error.
		try {
			const data = await streamParseJson(buffer, false)
			return validateParsedObject(data)
		} catch (e) {
			if (e instanceof StreamTooLargeError) return { error: TOO_LARGE_MESSAGE, data: null }
			return parseYaml(buffer, false)
		}
	}

	// Not JSON-looking - parse as YAML.
	return parseYaml(buffer, false)
}

/**
 * Stream-parse a buffer as JSON, rebuilding the object graph on the main thread without ever
 * creating the giant intermediate string. Optionally gunzips the input first.
 */
async function streamParseJson(buffer: Buffer, gz: boolean): Promise<unknown> {
	const source = createChunkedReadable(buffer, IMPORT_CHUNK_SIZE)
	const guard = createByteCountingTransform(MAX_STREAMED_DECOMPRESSED_FILE_SIZE)
	const jsonParser = parser()
	const assembler = Assembler.connectTo(jsonParser)

	if (gz) {
		await pipeline(source, zlib.createGunzip(), guard, jsonParser)
	} else {
		await pipeline(source, guard, jsonParser)
	}

	return assembler.current
}

/**
 * A valid export is always an object. Reject primitives/null - an empty or non-object JSON document
 * is not a usable export and would otherwise crash the downstream upgrade step.
 */
function validateParsedObject(parsed: unknown): ParseImportResult {
	if (!parsed || typeof parsed !== 'object') return { error: CORRUPTED_MESSAGE, data: null }
	return { error: null, data: parsed }
}

/** Emit the buffer in bounded slices so downstream transforms yield between chunks. */
function createChunkedReadable(buffer: Buffer, chunkSize: number): Readable {
	function* chunks(): Generator<Buffer> {
		for (let offset = 0; offset < buffer.length; offset += chunkSize) {
			yield buffer.subarray(offset, Math.min(offset + chunkSize, buffer.length))
		}
	}
	return Readable.from(chunks(), { objectMode: false })
}

/** Abort the pipeline if the running total of bytes passing through exceeds `limit`. zlib's
 * `maxOutputLength` only bounds a single chunk, so this guards the decompressed total. */
function createByteCountingTransform(limit: number): Transform {
	let total = 0
	return new Transform({
		transform(chunk: Buffer, _encoding, callback) {
			total += chunk.length
			if (total > limit) {
				callback(new StreamTooLargeError('Decompressed data exceeds the maximum allowed size'))
				return
			}
			callback(null, chunk)
		},
	})
}
