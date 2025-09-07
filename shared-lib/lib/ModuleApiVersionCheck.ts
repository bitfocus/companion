import semver from 'semver'

const MODULE_BASE_VERSION = '1.13.1'

const moduleVersion = semver.parse(MODULE_BASE_VERSION)
if (!moduleVersion) throw new Error(`Failed to parse version as semver: ${MODULE_BASE_VERSION}`)
const additionalVersions = moduleVersion.major === 1 ? '~0.6 ||' : '' // Allow 0.6, as it is compatible with 1.0, but semver made the jump necessary
const validApiRange = new semver.Range(
	`${additionalVersions} ${moduleVersion.major} <= ${moduleVersion.major}.${moduleVersion.minor}` // allow patch versions of the same minor
)

export function isModuleApiVersionCompatible(version: string): boolean {
	return version === MODULE_BASE_VERSION || validApiRange.test(version)
}
