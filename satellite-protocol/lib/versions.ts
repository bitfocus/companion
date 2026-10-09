import { isFalsey, type ParsedParams } from './codec.js'

export interface SatelliteFeatureDefinition {
	/** The first API version the feature exists in */
	readonly since: string
	/**
	 * The CAPS flag that says whether the feature is enabled on this connection, or null when it is always
	 * enabled once the API version supports it.
	 * The API version says whether a feature exists, CAPS says whether it is enabled right now.
	 */
	readonly capsFlag: string | null
	readonly description: string
}

/**
 * The features a client may need to gate on, by API version and CAPS flag
 */
export const SATELLITE_FEATURES = {
	lockState: {
		since: '1.8.0',
		capsFlag: null,
		description: 'The surface can draw the locked state itself (LOCKED-STATE)',
	},
	surfaceManifest: {
		since: '1.9.0',
		capsFlag: null,
		description: 'ADD-DEVICE accepts a LAYOUT_MANIFEST describing a complex surface',
	},
	deviceSerial: {
		since: '1.10.0',
		capsFlag: null,
		description: 'ADD-DEVICE accepts a SERIAL separate from the DEVICEID',
	},
	caps: {
		since: '1.10.0',
		capsFlag: null,
		description: 'CAPS is sent after BEGIN, and the connection is not ready until it has been received',
	},
	subscriptions: {
		since: '1.10.0',
		capsFlag: 'SUBSCRIPTIONS',
		description:
			'Button subscriptions (ADD-SUB, REMOVE-SUB, SUB-PRESS, SUB-ROTATE, SUB-STATE). Can be disabled by the user',
	},
	keyStateLocation: {
		since: '1.10.0',
		capsFlag: null,
		description: 'KEY-STATE carries LOCATION=page/row/column when known',
	},
	configFields: {
		since: '1.10.0',
		capsFlag: null,
		description: 'ADD-DEVICE accepts CONFIG_FIELDS, with values relayed back via DEVICE-CONFIG',
	},
	changePage: {
		since: '1.10.0',
		capsFlag: null,
		description: 'The surface can send CHANGE-PAGE',
	},
	firmwareUpdateInfo: {
		since: '1.10.0',
		capsFlag: null,
		description: 'The surface can send FIRMWARE-UPDATE-INFO',
	},
	nonSquareBitmaps: {
		since: '1.11.0',
		capsFlag: 'NONSQUARE',
		description: 'Bitmaps may be non-square',
	},
	bitmapFormats: {
		since: '1.12.0',
		capsFlag: 'BITMAP_FORMATS',
		description: 'BITMAP_FORMAT can be negotiated from the comma separated list in CAPS BITMAP_FORMATS',
	},
	leds: {
		since: '1.13.0',
		capsFlag: null,
		description: 'Style presets may request `leds` (addressable LED strips/rings), streamed as LEDS',
	},
	rotaryAmount: {
		since: '1.14.0',
		capsFlag: 'ROTARY_AMOUNT',
		description: 'DIRECTION on KEY-ROTATE and SUB-ROTATE may be a signed step count',
	},
	escapedValues: {
		since: '1.14.1',
		capsFlag: null,
		description: '`\\` and `"` inside quoted string values are escaped with a `\\`',
	},
} as const satisfies Record<string, SatelliteFeatureDefinition>

export type SatelliteFeatureId = keyof typeof SATELLITE_FEATURES

/**
 * Parse an API version (`major.minor.patch`, ignoring any prerelease or build suffix)
 * @returns the numeric parts, or null if it is not a valid version
 */
export function parseApiVersion(version: string): [number, number, number] | null {
	const match = /^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/.exec(version.trim())
	if (!match) return null
	return [Number(match[1]), Number(match[2]), Number(match[3])]
}

/**
 * Compare two API versions, for sorting. Invalid versions sort before all valid ones.
 * @returns negative if a < b, 0 if equal, positive if a > b
 */
export function compareApiVersions(a: string, b: string): number {
	const pa = parseApiVersion(a)
	const pb = parseApiVersion(b)
	if (!pa || !pb) return (pa ? 1 : 0) - (pb ? 1 : 0)

	for (let i = 0; i < 3; i++) {
		if (pa[i] !== pb[i]) return pa[i] - pb[i]
	}
	return 0
}

/**
 * Check if an API version is at least the given minimum. An invalid version is never at least anything.
 */
export function isApiVersionAtLeast(version: string, minimum: string): boolean {
	return parseApiVersion(version) !== null && compareApiVersions(version, minimum) >= 0
}

/**
 * Determine which features are available on a connection
 * @param apiVersion - the ApiVersion from BEGIN
 * @param caps - the parameters of CAPS, or null if it has not been received
 */
export function getSatelliteFeatures(
	apiVersion: string,
	caps: ParsedParams | null
): Record<SatelliteFeatureId, boolean> {
	const result = {} as Record<SatelliteFeatureId, boolean>
	for (const [id, feature] of Object.entries(SATELLITE_FEATURES) as [
		SatelliteFeatureId,
		SatelliteFeatureDefinition,
	][]) {
		let enabled = isApiVersionAtLeast(apiVersion, feature.since)
		if (enabled && feature.capsFlag !== null) {
			const value = caps?.[feature.capsFlag]
			enabled = value !== undefined && !isFalsey(value)
		}
		result[id] = enabled
	}
	return result
}
