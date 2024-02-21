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

export interface NewModuleUseVersion {
	type: 'builtin' | 'dev' | 'user'
	id?: string
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
	type: NewModuleUseVersion['type']
	isLegacy: boolean
}

export interface NewClientModuleInfo {
	baseInfo: NewClientModuleBaseInfo

	selectedVersion: NewClientModuleVersionInfo

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
