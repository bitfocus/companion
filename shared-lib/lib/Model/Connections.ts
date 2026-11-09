import type { CollectionBase, EnabledCollectionData } from './Collections.js'
import type { ClientInstanceConfigBase, ModuleInstanceType } from './Instance.js'

export interface ClientConnectionConfig extends ClientInstanceConfigBase {
	moduleType: ModuleInstanceType.Connection
	hasRecordActionsHandler: boolean
}

export type ConnectionCollectionData = EnabledCollectionData

export type ConnectionCollection = CollectionBase<ConnectionCollectionData>

export type ClientConnectionsUpdate =
	ClientConnectionsUpdateInitOp | ClientConnectionsUpdateUpdateOp | ClientConnectionsUpdateRemoveOp

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
