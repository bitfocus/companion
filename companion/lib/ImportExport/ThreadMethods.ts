/*
 * This file is part of the Companion project
 * Copyright (c) 2018 Bitfocus AS
 * Authors: William Viker <william@bitfocus.io>, Håkon Nessjøen <haakon@bitfocus.io>
 *
 * This program is free software.
 * You should have received a copy of the MIT licence as well as the Bitfocus
 * Individual Contributor License Agreement for companion along with
 * this program.
 */

import yaml from 'yaml'
import zlib from 'node:zlib'
import { promisify } from 'node:util'

const gunzipAsync = promisify(zlib.gunzip)

export interface ParseImportDataResult {
	error: string | null
	/** The parsed object, or null if parsing failed */
	data: unknown
	/** Timing information for debugging IPC overhead */
	timing: {
		workerStartTime: number
		gunzipStartTime: number
		gunzipEndTime: number
		parseStartTime: number
		parseEndTime: number
		workerEndTime: number
	}
}

/**
 * Parse import data in a worker thread.
 * This handles gunzip decompression (if needed) and YAML/JSON parsing.
 *
 * @param rawData - The raw ArrayBuffer data (potentially gzip compressed, transferred from main thread)
 * @returns The parsed object or error information, with timing data
 */
async function parseImportData(rawData: ArrayBuffer): Promise<ParseImportDataResult> {
	const timing = {
		workerStartTime: performance.now(),
		gunzipStartTime: 0,
		gunzipEndTime: 0,
		parseStartTime: 0,
		parseEndTime: 0,
		workerEndTime: 0,
	}

	// Convert Uint8Array back to Buffer for zlib compatibility

	let dataStr: string

	// Try to gunzip the data
	timing.gunzipStartTime = performance.now()
	try {
		const unzipped = await gunzipAsync(rawData)
		dataStr = unzipped.toString('utf-8')
	} catch (_e) {
		// Not compressed, use raw data
		dataStr = Buffer.from(rawData).toString('utf-8')
	}
	timing.gunzipEndTime = performance.now()

	// Parse YAML/JSON
	timing.parseStartTime = performance.now()
	let parsedData: unknown
	try {
		// YAML parser will handle JSON too
		parsedData = yaml.parse(dataStr)
	} catch (_e) {
		timing.parseEndTime = performance.now()
		timing.workerEndTime = performance.now()
		return {
			error: 'File is corrupted or unknown format',
			data: null,
			timing,
		}
	}
	timing.parseEndTime = performance.now()
	timing.workerEndTime = performance.now()

	return {
		error: null,
		data: parsedData,
		timing,
	}
}

export const ImportExportThreadMethods = {
	parseImportData,
}
