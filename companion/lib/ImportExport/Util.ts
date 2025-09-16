import zlib from 'node:zlib'
import yaml from 'yaml'
import type { ExportFormat } from '@companion-app/shared/Model/ExportFormat.js'
import type { SomeExportv6 } from '@companion-app/shared/Model/ExportModel.js'
import type { Logger } from 'winston'
import { promisify } from 'node:util'

const gzipAsync = promisify(zlib.gzip)

export interface StringifiedExportData {
	data: string | Buffer
	contentType: string
	asciiFilename: string
	utf8Filename: string
}

export async function stringifyExport(
	logger: Logger,
	data: SomeExportv6,
	filename: string,
	format: ExportFormat | undefined
): Promise<StringifiedExportData | null> {
	if (!format || format === 'json-gz') {
		try {
			const dataGz = await gzipAsync(JSON.stringify(data))
			return {
				data: dataGz,
				contentType: 'application/json',
				...formatAttachmentFilename(filename),
			}
		} catch (err) {
			logger.warn(`Failed to gzip data, retrying uncompressed: ${err}`)
			return stringifyExport(logger, data, filename, 'json')
		}
	} else if (format === 'json') {
		return {
			data: JSON.stringify(data, undefined, '\t'),
			contentType: 'application/json',
			...formatAttachmentFilename(filename),
		}
	} else if (format === 'yaml') {
		return {
			data: yaml.stringify(data, splitLongPng64Values),
			contentType: 'application/yaml',
			...formatAttachmentFilename(filename),
		}
	} else {
		return null
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
