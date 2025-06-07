import type { CollectionBase } from './Collections.js'

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

export type ConnectionCollection = CollectionBase<undefined>

export enum ConnectionUpdatePolicy {
	Manual = 'manual',
	Stable = 'stable',
	Beta = 'beta',
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
