import semver, { SemVer } from 'semver'

const range1_2_0OrLater = new semver.Range('>=1.2.0-0', { includePrerelease: true })
const range1_12_0OrLater = new semver.Range('>=1.12.0-0', { includePrerelease: true })
const range1_13_0OrLater = new semver.Range('>=1.13.0-1', { includePrerelease: true })

export function doesModuleExpectLabelUpdates(apiVersion: SemVer | string): boolean {
	return range1_2_0OrLater.test(apiVersion)
}

export function doesModuleSupportPermissionsModel(apiVersion: SemVer | string): boolean {
	return range1_12_0OrLater.test(apiVersion)
}

export function doesModuleUseSeparateUpgradeMethod(apiVersion: SemVer | string): boolean {
	return range1_13_0OrLater.test(apiVersion)
}
