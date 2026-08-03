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

import { promisify } from 'node:util'
import zlib from 'node:zlib'
import yaml from 'yaml'
import { MAX_DECOMPRESSED_FILE_SIZE } from './Constants.js'
import type { ParseImportResult } from './ParseImport.js'

const gunzipAsync = promisify(zlib.gunzip)

const YAML_TOO_LARGE_MESSAGE = 'This file is too large to import as YAML. Please re-export it as JSON and try again.'
const CORRUPTED_MESSAGE = 'File is corrupted or unknown format'

/**
 * Parse an import file as YAML in a worker thread.
 *
 * YAML has no streaming parser, so a large file must be read into a single string and parsed
 * synchronously. Doing that on the main thread would block the event loop long enough to time out
 * websocket/tRPC connections, so it runs here instead. The YAML parser handles JSON too, so this
 * also serves as the fallback for `{`-flow-style maps and hand-gzipped YAML that are not valid JSON
 * (JSON proper is stream-parsed on the main thread and never reaches here).
 *
 * @param rawData - The raw file bytes (transferred from the main thread)
 * @param isGzip - Whether the bytes are gzip compressed
 */
async function parseImportData(rawData: ArrayBuffer, isGzip: boolean): Promise<ParseImportResult> {
	let dataStr: string
	if (isGzip) {
		try {
			const unzipped = await gunzipAsync(rawData, { maxOutputLength: MAX_DECOMPRESSED_FILE_SIZE })
			dataStr = unzipped.toString('utf-8')
		} catch (e) {
			// The decompressed output exceeded the string limit - fail loudly rather than mislabelling
			// it as corrupted.
			if (e && typeof e === 'object' && 'code' in e && (e as { code?: string }).code === 'ERR_BUFFER_TOO_LARGE') {
				return { error: YAML_TOO_LARGE_MESSAGE, data: null }
			}
			return { error: CORRUPTED_MESSAGE, data: null }
		}
	} else {
		const buffer = Buffer.from(rawData)
		// toString('utf-8') throws for a buffer larger than MAX_STRING_LENGTH; reject cleanly first.
		if (buffer.length > MAX_DECOMPRESSED_FILE_SIZE) return { error: YAML_TOO_LARGE_MESSAGE, data: null }
		dataStr = buffer.toString('utf-8')
	}

	let parsedData: unknown
	try {
		// The YAML parser handles JSON too
		parsedData = yaml.parse(dataStr)
	} catch {
		return { error: CORRUPTED_MESSAGE, data: null }
	}

	// A valid export is always an object. Reject primitives/null - YAML leniently parses an empty
	// file as `null` and arbitrary text/binary as a scalar string, neither of which is a usable
	// export and would otherwise crash the downstream upgrade step.
	if (!parsedData || typeof parsedData !== 'object') {
		return { error: CORRUPTED_MESSAGE, data: null }
	}

	return { error: null, data: parsedData }
}

export const ImportExportThreadMethods = {
	parseImportData,
}
