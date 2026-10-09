import { SATELLITE_BITMAP_FORMATS, type SatelliteBitmapFormat } from './constants.js'

/**
 * Keys that could pollute the prototype chain if parsed params were ever copied onto a normal object
 * downstream. The parsed object is prototype-less, so these are harmless on it directly, but they are
 * dropped anyway.
 */
export const BANNED_PROPS: ReadonlySet<string> = new Set([
	'__proto__',
	'constructor',
	'prototype',
	'__defineGetter__',
	'__defineSetter__',
	'__lookupGetter__',
	'__lookupSetter__',
])

/**
 * The parameters of a Satellite API message.
 * A parameter given without a value (`FLAG`) is `true`, anything else is the raw string value.
 */
export type ParsedParams = Record<string, string | true | undefined>

/**
 * Arguments for a Satellite API message to be sent
 */
export type SatelliteMessageArgs = Record<string, string | number | boolean>

/**
 * Check if Satellite API value is falsey
 */
export const isFalsey = (val: unknown): boolean => {
	// eslint-disable-next-line no-extra-boolean-cast
	return (typeof val === 'string' && val.toLowerCase() == 'false') || val == '0' || !Boolean(val)
}

/**
 * Check if Satellite API value is truthy
 */
export const isTruthy = (val: unknown): boolean => {
	return (
		!isFalsey(val) &&
		((typeof val === 'string' && (val.toLowerCase() == 'true' || val.toLowerCase() == 'yes')) || Number(val) >= 1)
	)
}

/**
 * Checks if parameter is one of the list and returns it if so.
 * If it is not in the list but a trueish value, the defaultVal will be returned.
 * Otherwise returns null.
 */
export function parseStringParamWithBooleanFallback<T extends string>(
	list: T[],
	defaultVal: T,
	parameter: unknown
): T | null {
	const param = String(parameter) as T
	if (list.includes(param)) {
		return param
	}
	if (isTruthy(parameter)) {
		return defaultVal
	}
	return null
}

/**
 * Validate a client-reported bitmap format, falling back to `rgb` when absent or unknown.
 * Older satellites won't send a format, and we must never assume a decoder they didn't advertise.
 */
export function parseSatelliteBitmapFormat(value: string | boolean | undefined): SatelliteBitmapFormat {
	if (typeof value === 'string' && SATELLITE_BITMAP_FORMATS.includes(value as SatelliteBitmapFormat)) {
		return value as SatelliteBitmapFormat
	}
	return 'rgb'
}

/**
 * Parse the parameters of a Satellite API message (the line, after the command name)
 */
export function parseLineParameters(line: string): ParsedParams {
	const makeSafe = (index: number) => {
		return index === -1 ? Number.POSITIVE_INFINITY : index
	}

	const fragments = ['']
	let quotes = 0

	let i = 0
	while (i < line.length) {
		// Find the next characters of interest
		const spaceIndex = makeSafe(line.indexOf(' ', i))
		const slashIndex = makeSafe(line.indexOf('\\', i))
		const quoteIndex = makeSafe(line.indexOf('"', i))

		// Find which is closest
		const o = Math.min(spaceIndex, slashIndex, quoteIndex)
		if (!isFinite(o)) {
			// None were found, copy the remainder and stop
			const slice = line.substring(i)
			fragments[fragments.length - 1] += slice

			break
		} else {
			// copy the slice before this character
			const slice = line.substring(i, o)
			fragments[fragments.length - 1] += slice

			const c = line[o]
			if (c == '\\') {
				// If char is a slash, the character following it is of interest
				// Future: does this consider non \" chars?
				fragments[fragments.length - 1] += line[o + 1] ?? ''

				i = o + 2
			} else {
				i = o + 1

				// Figure out what the char was
				if (c === '"') {
					quotes ^= 1
				} else if (!quotes && c === ' ') {
					fragments.push('')
				} else {
					fragments[fragments.length - 1] += c
				}
			}
		}
	}

	const res: ParsedParams = Object.create(null)

	for (const fragment of fragments) {
		// Split on the first `=` only, keeping the rest of the value intact. A plain
		// `split('=', 2)` would truncate at the first `=`, which corrupts values that
		// legitimately contain it - e.g. the base64 `=` padding of a `data:` url bitmap,
		// breaking image decoding.
		const splitIndex = fragment.indexOf('=')
		if (splitIndex === -1) {
			// Skip empty fragments (from consecutive/leading/trailing spaces) and dangerous keys
			if (fragment === '' || BANNED_PROPS.has(fragment)) continue
			res[fragment] = true
		} else {
			const key = fragment.substring(0, splitIndex)
			if (key === '' || BANNED_PROPS.has(key)) continue
			res[key] = fragment.substring(splitIndex + 1)
		}
	}

	return res
}

/**
 * Quote a string value, escaping the characters {@link parseLineParameters} treats specially inside quotes
 */
function quoteValue(value: string): string {
	return `"${value.replace(/[\\"]/g, (c) => `\\${c}`)}"`
}

/**
 * Format a Satellite API message, including the terminating newline.
 * Booleans are sent as `1`/`0`, numbers bare and strings quoted (with `\` and `"` escaped).
 * The values must not contain newlines, as those terminate the message.
 */
export function formatSatelliteMessage(
	messageName: string,
	status: 'OK' | 'ERROR' | null,
	deviceId: string | null,
	args: SatelliteMessageArgs
): string {
	const chunks: string[] = [messageName]
	if (status) chunks.push(status)
	if (deviceId) chunks.push(`DEVICEID=${quoteValue(deviceId)}`)

	for (const [key, value] of Object.entries(args)) {
		let valueStr: string
		if (typeof value === 'boolean') {
			valueStr = value ? '1' : '0'
		} else if (typeof value === 'number') {
			valueStr = value.toString()
		} else {
			valueStr = quoteValue(value)
		}
		chunks.push(`${key}=${valueStr}`)
	}

	chunks.push('\n')
	return chunks.join(' ')
}
