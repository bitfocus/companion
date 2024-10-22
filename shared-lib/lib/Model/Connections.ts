import type { ModuleVersionMode } from './ModuleInfo.js'

export interface ConnectionConfig {
	label: string
	config: unknown
	isFirstInit: boolean
	lastUpgradeIndex: number
	instance_type: string
	enabled: boolean
	sortOrder: number
	/**
	 * Which version of the module to use
	 */
	moduleVersionMode: ModuleVersionMode
	moduleVersionId: string | null
}

export interface ClientConnectionConfig {
	label: string
	instance_type: string
	moduleVersionMode: ModuleVersionMode
	moduleVersionId: string | null
	enabled: boolean
	sortOrder: number
	hasRecordActionsHandler: boolean
}

export type ClientConnectionsUpdate = ClientConnectionsUpdateUpdateOp | ClientConnectionsUpdateRemoveOp

export interface ClientConnectionsUpdateRemoveOp {
	type: 'remove'
	id: string
}
// export interface ClientConnectionsUpdateAddOp {
// 	type: 'add'
// 	id: string

// 	info: ClientConnectionConfig
// }
export interface ClientConnectionsUpdateUpdateOp {
	type: 'update'
	id: string

	// patch: JsonPatchOperation[]
	info: ClientConnectionConfig
}
