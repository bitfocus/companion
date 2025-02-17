import type { Operation as JsonPatchOperation } from 'fast-json-patch'

export interface ModuleDisplayInfo {
	id: string
	name: string
	helpPath: string
	bugUrl: string
	shortname: string
	manufacturer: string
	products: string[]
	keywords: string[]
}

export interface ClientModuleVersionInfo {
	displayName: string
	isLegacy: boolean
	isBeta: boolean
	helpPath: string
	versionId: string
}

export interface ClientModuleInfo {
	display: ModuleDisplayInfo

	devVersion: ClientModuleVersionInfo | null

	stableVersion: ClientModuleVersionInfo | null
	betaVersion: ClientModuleVersionInfo | null

	installedVersions: ClientModuleVersionInfo[]
}

export type ModuleInfoUpdate = ModuleInfoUpdateAddOp | ModuleInfoUpdateUpdateOp | ModuleInfoUpdateRemoveOp

export interface ModuleInfoUpdateRemoveOp {
	type: 'remove'
	id: string
}
export interface ModuleInfoUpdateAddOp {
	type: 'add'
	id: string

	info: ClientModuleInfo
}
export interface ModuleInfoUpdateUpdateOp {
	type: 'update'
	id: string

	patch: JsonPatchOperation[]
}

/**
 * Description of a version of another module that this module can be upgraded to.
 */
export interface ModuleUpgradeToOtherVersion {
	moduleId: string
	displayName: string
	// isBeta: boolean
	helpPath: string | null
	versionId: string | null
}
