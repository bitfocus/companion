import semver from 'semver'
import { ModuleInstanceType } from './Model/Instance.js'
import { assertNever } from './Util.js'

export const MODULE_BASE_VERSION = '1.14.0'
// export const MODULE_BASE_VERSION = '1.99.0-0-nightly-feat-split-api-20251221-153951-fa12995'
export const SURFACE_BASE_VERSION = '1.1.0'

const moduleVersion = semver.parse(MODULE_BASE_VERSION)
if (!moduleVersion) throw new Error(`Failed to parse version as semver: ${MODULE_BASE_VERSION}`)
const additionalModuleVersions = moduleVersion.major === 1 ? '~0.6 ||' : '' // Allow 0.6, as it is compatible with 1.0, but semver made the jump necessary
const validModuleApiRange = new semver.Range(
	`${additionalModuleVersions} ${moduleVersion.major} <= ${moduleVersion.major}.${moduleVersion.minor}` // allow patch versions of the same minor
)

const surfaceVersion = semver.parse(SURFACE_BASE_VERSION)
if (!surfaceVersion) throw new Error(`Failed to parse version as semver: ${SURFACE_BASE_VERSION}`)
const validSurfaceApiRange = new semver.Range(
	`${surfaceVersion.major} <= ${surfaceVersion.major}.${surfaceVersion.minor}` // allow patch versions of the same minor
)

export function isModuleApiVersionCompatible(version: string): boolean {
	return version === MODULE_BASE_VERSION || validModuleApiRange.test(version)
}

export function isSurfaceApiVersionCompatible(version: string): boolean {
	return version === SURFACE_BASE_VERSION || validSurfaceApiRange.test(version)
}

export function isSomeModuleApiVersionCompatible(moduleType: ModuleInstanceType, version: string): boolean {
	switch (moduleType) {
		case ModuleInstanceType.Connection:
			return isModuleApiVersionCompatible(version)
		case ModuleInstanceType.Surface:
			return isSurfaceApiVersionCompatible(version)
		default:
			assertNever(moduleType)
			return false
	}
}
