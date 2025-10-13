import semver from 'semver'
import { ModuleInstanceType } from './Model/Instance.js'
import { assertNever } from './Util.js'

export const MODULE_BASE_VERSION = '1.14.0'
export const SURFACE_BASE_VERSION = '0.0.0' // TODO

const moduleVersion = semver.parse(MODULE_BASE_VERSION)
if (!moduleVersion) throw new Error(`Failed to parse version as semver: ${MODULE_BASE_VERSION}`)
const additionalVersions = moduleVersion.major === 1 ? '~0.6 ||' : '' // Allow 0.6, as it is compatible with 1.0, but semver made the jump necessary
const validApiRange = new semver.Range(
	`${additionalVersions} ${moduleVersion.major} <= ${moduleVersion.major}.${moduleVersion.minor}` // allow patch versions of the same minor
)

export function isModuleApiVersionCompatible(version: string): boolean {
	return version === MODULE_BASE_VERSION || validApiRange.test(version)
}

export function isSurfaceApiVersionCompatible(_version: string): boolean {
	// TODO
	return true
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
