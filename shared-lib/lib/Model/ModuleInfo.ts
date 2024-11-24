import type { Operation as JsonPatchOperation } from 'fast-json-patch'

export interface ModuleDisplayInfo {
	id: string
	name: string
	version: string
	hasHelp: boolean
	bugUrl: string
	shortname: string
	manufacturer: string
	products: string[]
	keywords: string[]
	isLegacy?: boolean
}

export interface NewClientModuleBaseInfo {
	id: string
	name: string
	// hasHelp: boolean
	bugUrl: string
	shortname: string
	manufacturer: string
	products: string[]
	keywords: string[]
}

export interface NewClientModuleVersionInfo2 {
	displayName: string
	isLegacy: boolean
	isBeta: boolean
	hasHelp: boolean
	versionId: string
}

export interface NewClientModuleInfo {
	baseInfo: NewClientModuleBaseInfo

	devVersion: NewClientModuleVersionInfo2 | null

	stableVersion: NewClientModuleVersionInfo2 | null
	betaVersion: NewClientModuleVersionInfo2 | null

	installedVersions: NewClientModuleVersionInfo2[]
}

export type ModuleInfoUpdate = ModuleInfoUpdateAddOp | ModuleInfoUpdateUpdateOp | ModuleInfoUpdateRemoveOp

export interface ModuleInfoUpdateRemoveOp {
	type: 'remove'
	id: string
}
export interface ModuleInfoUpdateAddOp {
	type: 'add'
	id: string

	info: NewClientModuleInfo
}
export interface ModuleInfoUpdateUpdateOp {
	type: 'update'
	id: string

	patch: JsonPatchOperation[]
}
