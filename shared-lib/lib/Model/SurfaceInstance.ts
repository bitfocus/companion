import type { CollectionBase } from './Collections.js'
import type { ClientInstanceConfigBase, ModuleInstanceType } from './Instance.js'
import type { CompanionSurfaceConfigField } from './Surfaces.js'

export interface ClientSurfaceInstanceConfig extends ClientInstanceConfigBase {
	moduleType: ModuleInstanceType.Surface

	remoteConfigFields: CompanionSurfaceConfigField[] | null
	remoteConfigMatches: string | null
}

export interface SurfaceInstanceCollectionData {
	enabled: boolean
}

export type SurfaceInstanceCollection = CollectionBase<SurfaceInstanceCollectionData>

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
