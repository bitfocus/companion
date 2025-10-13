import type { Operation as JsonPatchOperation } from 'fast-json-patch'
import { ModuleInstanceType } from './Instance.js'

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
	moduleType: ModuleInstanceType
	display: ModuleDisplayInfo

	devVersion: ClientModuleVersionInfo | null

	stableVersion: ClientModuleVersionInfo | null
	betaVersion: ClientModuleVersionInfo | null

	installedVersions: ClientModuleVersionInfo[]
}

export type ModuleInfoUpdateId = `${ModuleInstanceType}:${string}`
export type ModuleInfoUpdate =
	| ModuleInfoUpdateInitOp
	| ModuleInfoUpdateAddOp
	| ModuleInfoUpdateUpdateOp
	| ModuleInfoUpdateRemoveOp
export interface ModuleInfoUpdateInitOp {
	type: 'init'
	info: Record<ModuleInfoUpdateId, ClientModuleInfo>
}
export interface ModuleInfoUpdateRemoveOp {
	type: 'remove'
	id: ModuleInfoUpdateId
}
export interface ModuleInfoUpdateAddOp {
	type: 'add'
	id: ModuleInfoUpdateId

	info: ClientModuleInfo
}
export interface ModuleInfoUpdateUpdateOp {
	type: 'update'
	id: ModuleInfoUpdateId

	patch: JsonPatchOperation<ClientModuleInfo>[]
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
