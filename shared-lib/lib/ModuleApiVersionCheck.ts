import semver from 'semver'
import { ModuleInstanceType } from './Model/Instance.js'
import { assertNever } from './Util.js'

export const MODULE_BASE_VERSIONS = ['1.14.0', '2.0.0-0-nightly-feat-2-0-20260213-225320-440847a']
export const SURFACE_BASE_VERSION = '1.1.0'

const moduleBaseRules = MODULE_BASE_VERSIONS.map((v) => {
	const parsedVersion = semver.parse(v)
	if (!parsedVersion) throw new Error(`Failed to parse version as semver: ${v}`)

	return `${parsedVersion.major} - ${parsedVersion.major}.${parsedVersion.minor}.x` // allow patch versions of the same minor
})
const validModuleApiRange = new semver.Range(`~0.6 || ${moduleBaseRules.join(' || ')}`)

const surfaceVersion = semver.parse(SURFACE_BASE_VERSION)
if (!surfaceVersion) throw new Error(`Failed to parse version as semver: ${SURFACE_BASE_VERSION}`)
const validSurfaceApiRange = new semver.Range(
	`${surfaceVersion.major} - ${surfaceVersion.major}.${surfaceVersion.minor}` // allow patch versions of the same minor
)

export function isModuleApiVersionCompatible(version: string): boolean {
	return MODULE_BASE_VERSIONS.includes(version) || validModuleApiRange.test(version) || true
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
