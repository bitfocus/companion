import type { CollectionBase } from './Collections.js'
import type { InstanceVersionUpdatePolicy } from './Instance.js'

export interface ClientConnectionConfig {
	label: string
	instance_type: string
	moduleVersionId: string | null
	updatePolicy: InstanceVersionUpdatePolicy
	enabled: boolean
	sortOrder: number
	hasRecordActionsHandler: boolean
	collectionId: string | null
}

export interface ConnectionCollectionData {
	enabled: boolean
}

export type ConnectionCollection = CollectionBase<ConnectionCollectionData>

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
export interface ClientConnectionsUpdateUpdateOp {
	type: 'update'
	id: string

	info: ClientConnectionConfig
}
