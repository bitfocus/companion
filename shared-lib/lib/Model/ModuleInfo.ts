import type { ObjectPatch } from '../Diff.js'
import type { ModuleInstanceType } from './Instance.js'

export interface ModuleDisplayInfo {
	id: string
	name: string
	helpPath: string
	bugUrl: string
	shortname: string
	/** null when the manifest doesn't declare one (surface modules) */
	manufacturer: string | null
	/** Product names as declared, without the manufacturer */
	products: string[]
	keywords: string[]
}

export interface ClientModuleVersionInfo {
	displayName: string
	isLegacy: boolean
	isBeta: boolean
	/** Whether the module requested an end-of-life runtime, and is being run on a newer one instead */
	isRuntimeOverridden: boolean
	helpPath: string
	versionId: string
	/** Only applicable for surface modules. Whether multiple instances are allowed */
	allowMultipleInstances: boolean
}

export interface ClientModuleInfo {
	moduleType: ModuleInstanceType
	display: ModuleDisplayInfo

	devVersion: ClientModuleVersionInfo | null
	builtinVersion: ClientModuleVersionInfo | null

	stableVersion: ClientModuleVersionInfo | null
	betaVersion: ClientModuleVersionInfo | null

	installedVersions: ClientModuleVersionInfo[]
}

export type ModuleInfoUpdateId = `${ModuleInstanceType}:${string}`
export type ModuleInfoUpdate =
	ModuleInfoUpdateInitOp | ModuleInfoUpdateAddOp | ModuleInfoUpdateUpdateOp | ModuleInfoUpdateRemoveOp
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

	patch: ObjectPatch<ClientModuleInfo>
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
