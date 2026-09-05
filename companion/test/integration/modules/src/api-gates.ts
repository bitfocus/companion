/*
 * Version gates for the fixture module sources. Each fixture is bundled against a specific
 * @companion-module/base version (injected as process.env.FIXTURE_API_VERSION by
 * build-module-fixtures.mts), and uses these gates to only register definitions that the api of
 * that version supports. ModuleVersions.test.ts consumes the same feature map to know what each
 * fixture must (and must not) provide.
 */
import featuresJson from './module-api-features.json' with { type: 'json' }

const { features } = featuresJson

export function apiVersionAtLeast(version: string, minVersion: string): boolean {
	const a = version.split('.').map(Number)
	const b = minVersion.split('.').map(Number)
	for (let i = 0; i < 3; i++) {
		if ((a[i] ?? 0) > (b[i] ?? 0)) return true
		if ((a[i] ?? 0) < (b[i] ?? 0)) return false
	}
	return true
}

export function hasApiFeature(version: string, featureId: string): boolean {
	const feature = (features as Record<string, { minApiVersion: string }>)[featureId]
	if (!feature) throw new Error(`Unknown api feature "${featureId}"`)
	return apiVersionAtLeast(version, feature.minApiVersion)
}
