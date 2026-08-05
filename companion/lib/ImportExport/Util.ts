import { randomUUID } from 'node:crypto'
import { createWriteStream } from 'node:fs'
import fs from 'node:fs/promises'
import { Readable, Transform, type Writable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import zlib from 'node:zlib'
import disassembler from 'stream-json/disassembler.js'
import stringer from 'stream-json/stringer.js'
import yaml from 'yaml'
import type { ExportFormat } from '@companion-app/shared/Model/ExportFormat.js'
import type { ExportPageContentv6, SomeExportv6 } from '@companion-app/shared/Model/ExportModel.js'
import type { UserConfigGridSize } from '@companion-app/shared/Model/UserConfigModel.js'

/** Error thrown when an export is too large to serialise in the requested (non-streamed) format. */
export class ExportTooLargeError extends Error {}

/**
 * The result of {@link prepareExport}: either a fully-serialised buffer/string ready to send, or an
 * instruction to stream the export (used when the data is too large for a single JS string).
 */
export type PreparedExport = { kind: 'buffer'; data: string | Buffer } | { kind: 'stream'; format: 'json' | 'json-gz' }

/**
 * Decide how to serialise an export:
 * - `json-gz` always streams, so a giant JSON string is never created (it would exceed the V8
 *   string limit for large configs).
 * - `json` is serialised pretty (tab-indented) for git-diff-ability, falling back to compact
 *   streaming only if it exceeds the string limit.
 * - `yaml` is serialised natively; if it is too large it is rejected with a clear
 *   {@link ExportTooLargeError} rather than crashing.
 *
 * An undefined/unknown format defaults to `json-gz` (matching the historic behaviour).
 */
export function prepareExport(data: SomeExportv6, format: ExportFormat | undefined): PreparedExport {
	if (format === 'json') {
		try {
			return { kind: 'buffer', data: JSON.stringify(data, undefined, '\t') }
		} catch (e) {
			// A config too large to stringify still needs to export - fall back to compact streaming.
			if (e instanceof RangeError) return { kind: 'stream', format: 'json' }
			throw e
		}
	} else if (format === 'yaml') {
		try {
			return { kind: 'buffer', data: yaml.stringify(data, splitLongPng64Values) }
		} catch (e) {
			if (e instanceof RangeError) {
				throw new ExportTooLargeError('Export is too large for the YAML format. Please export as JSON.')
			}
			throw e
		}
	} else {
		// json-gz (and the undefined/default case)
		return { kind: 'stream', format: 'json-gz' }
	}
}

/**
 * Stream an export object to a destination as JSON, walking the object graph token-by-token (via
 * stream-json) so the giant intermediate string is never created. gzips the output for `json-gz`.
 *
 * @returns the number of bytes written to `destination`.
 */
export async function streamExport(
	data: SomeExportv6,
	format: 'json' | 'json-gz',
	destination: Writable
): Promise<number> {
	// Wrap in an array so Readable.from emits the export object itself as a single object-mode chunk.
	const source = Readable.from([data], { objectMode: true })
	const disassemblerStream = disassembler.asStream()
	const stringerStream = stringer.asStream()

	// Count the bytes as they flow to the destination, so callers (e.g. backups) don't have to stat
	// the file afterwards.
	let byteCount = 0
	const counter = new Transform({
		transform(chunk: Buffer, _encoding, callback) {
			byteCount += chunk.length
			callback(null, chunk)
		},
	})

	if (format === 'json-gz') {
		await pipeline(source, disassemblerStream, stringerStream, zlib.createGzip(), counter, destination)
	} else {
		await pipeline(source, disassemblerStream, stringerStream, counter, destination)
	}

	return byteCount
}

/**
 * Serialise an export and write it to `filePath` atomically and without clobbering: the data is
 * written to a uniquely-named temporary sibling and only published once the write completes, so a
 * failure (a broken stream, a full disk, ...) never leaves a partial or corrupt file at `filePath`,
 * and a file already present at `filePath` (e.g. a backup written concurrently under the same
 * generated name) is never overwritten.
 *
 * @returns the number of bytes written.
 * @throws {ExportTooLargeError} when an oversized export cannot be serialised in the requested format.
 * @throws an `EEXIST` error when `filePath` already exists.
 */
export async function writeExportToFile(
	data: SomeExportv6,
	format: ExportFormat | undefined,
	filePath: string
): Promise<number> {
	// May throw ExportTooLargeError before anything is written - surfaced to the caller.
	const prepared = prepareExport(data, format)

	const tempPath = `${filePath}.${randomUUID()}.tmp`
	try {
		let fileSize: number
		if (prepared.kind === 'buffer') {
			await fs.writeFile(tempPath, prepared.data)
			fileSize = Buffer.byteLength(prepared.data)
		} else {
			// Large export - stream it to the file so the giant JSON string is never created.
			fileSize = await streamExport(data, prepared.format, createWriteStream(tempPath))
		}

		await publishFileNoClobber(tempPath, filePath)
		return fileSize
	} finally {
		// Always drop the temp name: on success the content lives on at filePath (via the hard link);
		// on any failure this removes the partial/orphaned temp file. Best-effort - never mask the error.
		await fs.rm(tempPath, { force: true }).catch(() => {})
	}
}

/**
 * Publish a completed temp file to its final path without clobbering an existing file. `fs.link` is
 * atomic and fails with `EEXIST` if `filePath` already exists, so a file written concurrently under
 * the same name is never overwritten (`fs.rename` would silently clobber it).
 *
 * `EEXIST` is the one error we honour; any other link failure means hard-links aren't usable at the
 * destination (many network/cloud FUSE mounts reject `fs.link` with codes like `EPERM`, `ENOSYS`,
 * `ENOTSUP`, `EOPNOTSUPP`, `EIO` or `EXDEV`) so we fall back to `rename`, where the no-clobber race
 * is unavoidable. If the fallback can't publish either, its error surfaces instead.
 */
async function publishFileNoClobber(tempPath: string, filePath: string): Promise<void> {
	try {
		await fs.link(tempPath, filePath)
	} catch (e) {
		if ((e as NodeJS.ErrnoException)?.code === 'EEXIST') throw e

		await fs.rename(tempPath, filePath)
	}
}

/**
 * Replacer that splits "png64" values into multiple lines.
 *
 * These are base64 encoded PNGs and can get very long. A length of 60 characters is used to allow
 * for indentation in the YAML.
 *
 * @param key - The key of the value being processed.
 * @param value - The value to be processed.
 * @returns The modified value or the original value if the conditions are not met.
 */
function splitLongPng64Values(key: string, value: string): string {
	if (typeof value === 'string' && value.length > 60 && (key === 'png64' || value.startsWith('data:image'))) {
		try {
			// Support "data:...;base64,..." by extracting the base64 payload.
			const m = value.match(/^(data:[^;]+;base64,)([\s\S]*)$/)
			let prefix = ''
			let b64 = value
			if (m) {
				prefix = m[1]
				b64 = m[2]
			}

			const normalized = btoa(atob(b64))
			return (prefix ? prefix + normalized : normalized).replace(/(.{60})/g, '$1\n') + '\n'
		} catch {
			// If it's not valid base64, return the original value unchanged.
			return value
		}
	}
	return value
}

/**
 * Compute a Content-Disposition header specifying an attachment with the
 * given filename.
 */
export function formatAttachmentFilename(filename: string): {
	asciiFilename: string
	utf8Filename: string
} {
	function quotedAscii(s: string): string {
		// Boil away combining characters and non-ASCII code points and escape
		// quotes.  Modern browsers don't use this, so don't bother going all-out.
		// Don't percent-encode anything, because browsers don't agree on whether
		// quoted filenames should be percent-decoded (Firefox and Chrome yes,
		// Safari no).
		return (
			'"' +
			[...s.normalize('NFKD')]
				.filter((c) => '\x20' <= c && c <= '\x7e')
				.map((c) => (c === '"' || c === '\\' ? '\\' : '') + c)
				.join('') +
			'"'
		)
	}

	// The filename parameter is used primarily by legacy browsers.  Strangely, it
	// must be present for at least some versions of Safari to use the modern
	// filename* parameter.
	const quotedFallbackAsciiFilename = quotedAscii(filename)
	const modernUnicodeFilename = encodeURIComponent(filename)
	// return `attachment; filename=${quotedFallbackAsciiFilename}; filename*=UTF-8''${modernUnicodeFilename}`

	return {
		asciiFilename: quotedFallbackAsciiFilename,
		utf8Filename: modernUnicodeFilename,
	}
}

export const find_smallest_grid_for_page = (pageInfo: ExportPageContentv6): UserConfigGridSize => {
	const gridSize: UserConfigGridSize = {
		minColumn: 0,
		maxColumn: 7,
		minRow: 0,
		maxRow: 3,
	}

	// Scan through the data in the export, to find the minimum possible grid size
	for (const [row0, rowObj] of Object.entries(pageInfo.controls || {})) {
		const row = Number(row0)
		let foundControl = false

		for (const column0 of Object.keys(rowObj)) {
			const column = Number(column0)

			if (!rowObj[column]) continue
			foundControl = true

			if (column < gridSize.minColumn) gridSize.minColumn = column
			if (column > gridSize.maxColumn) gridSize.maxColumn = column
		}

		if (foundControl) {
			if (row < gridSize.minRow) gridSize.minRow = row
			if (row > gridSize.maxRow) gridSize.maxRow = row
		}
	}

	return gridSize
}
