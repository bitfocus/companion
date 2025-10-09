import type { CollectionBase } from './Collections.js'

export enum ModuleInstanceType {
	Connection = 'connection',
	// Surface = 'surface', // Future
}

export interface ConnectionConfig {
	label: string
	config: unknown
	secrets: unknown | undefined
	isFirstInit: boolean
	lastUpgradeIndex: number
	instance_type: string
	enabled: boolean
	sortOrder: number
	moduleVersionId: string | null
	updatePolicy: ConnectionUpdatePolicy // TODO - upgrade script
	collectionId?: string
}

export interface ClientConnectionConfig {
	label: string
	instance_type: string
	moduleVersionId: string | null
	updatePolicy: ConnectionUpdatePolicy
	enabled: boolean
	sortOrder: number
	hasRecordActionsHandler: boolean
	collectionId: string | null
}

export interface ConnectionCollectionData {
	enabled: boolean
}

export type ConnectionCollection = CollectionBase<ConnectionCollectionData>

export enum ConnectionUpdatePolicy {
	Manual = 'manual',
	Stable = 'stable',
	Beta = 'beta',
}

export type ClientConnectionsUpdate =
	| ClientConnectionsUpdateInitOp
	| ClientConnectionsUpdateUpdateOp
	| ClientConnectionsUpdateRemoveOp

export interface ClientConnectionsUpdateInitOp {
	type: 'init'
	info: Record<string, ClientConnectionConfig>
}
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

// export type ConnectionGroupsUpdate = ConnectionGroupsUpdateUpdateOp | ConnectionGroupsUpdateRemoveOp

// export interface ConnectionGroupsUpdateRemoveOp {
// 	type: 'remove'
// 	id: string
// }

// export interface ConnectionGroupsUpdateUpdateOp {
// 	type: 'update'
// 	id: string

// 	info: ConnectionGroup
// }
