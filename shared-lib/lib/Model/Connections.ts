import type { CollectionBase } from './Collections.js'
import type { ClientInstanceConfigBase } from './Instance.js'

export interface ClientConnectionConfig extends ClientInstanceConfigBase {
	sortOrder: number
	hasRecordActionsHandler: boolean
	collectionId: string | null
}

export interface ClientSurfaceInstanceConfig {
	label: string
	moduleId: string
	moduleVersionId: string | null
	updatePolicy: InstanceVersionUpdatePolicy
	enabled: boolean
	sortOrder: number
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

export type ClientSurfaceInstancesUpdate =
	| ClientSurfaceInstancesUpdateInitOp
	| ClientSurfaceInstancesUpdateUpdateOp
	| ClientSurfaceInstancesUpdateRemoveOp

export interface ClientSurfaceInstancesUpdateInitOp {
	type: 'init'
	info: Record<string, ClientSurfaceInstanceConfig>
}
export interface ClientSurfaceInstancesUpdateRemoveOp {
	type: 'remove'
	id: string
}
export interface ClientSurfaceInstancesUpdateUpdateOp {
	type: 'update'
	id: string

	info: ClientSurfaceInstanceConfig
}
