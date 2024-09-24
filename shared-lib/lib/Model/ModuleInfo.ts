import type { Operation as JsonPatchOperation } from 'fast-json-patch'

export type ModuleVersion = 'builtin' | 'dev' | string

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
	hasHelp: boolean
	bugUrl: string
	shortname: string
	manufacturer: string
	products: string[]
	keywords: string[]
}

export interface NewClientModuleVersionInfo {
	version: string
	type: 'builtin' | 'user' | 'dev'
	isLegacy: boolean
	hasHelp: boolean
}

export interface NewClientModuleInfo {
	baseInfo: NewClientModuleBaseInfo

	defaultVersion: Omit<NewClientModuleVersionInfo, 'type'>

	allVersions: NewClientModuleVersionInfo[]
}

export type ModuleInfoUpdate = ModuleInfoUpdateAddOp | ModuleInfoUpdateUpdateOp

// export interface ModuleInfoUpdateRemoveOp {
// 	type: 'remove'
// 	id: string
// }
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
