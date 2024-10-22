import type { Operation as JsonPatchOperation } from 'fast-json-patch'

export type ModuleVersionMode = 'stable' | 'prerelease' | 'specific-version'
export interface ModuleVersionInfo {
	mode: ModuleVersionMode
	id: string | null // Only used for 'specific-version' and 'custom
}

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
	isDev: boolean
	isBuiltin: boolean
	version: ModuleVersionInfo
	hasHelp: boolean
}

export interface NewClientModuleVersionInfo2Ext extends NewClientModuleVersionInfo2 {
	versionId: string
}

export interface NewClientModuleInfo {
	baseInfo: NewClientModuleBaseInfo

	hasDevVersion: boolean
	// devVersion: NewClientModuleVersionInfo2 | null

	stableVersion: NewClientModuleVersionInfo2Ext | null
	prereleaseVersion: NewClientModuleVersionInfo2Ext | null

	installedVersions: NewClientModuleVersionInfo2[]

	// defaultVersion: Omit<NewClientModuleVersionInfo, 'type'>

	// allVersions: NewClientModuleVersionInfo[]
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
