export interface ConnectionConfig {
	label: string
	config: unknown
	isFirstInit: boolean
	lastUpgradeIndex: number
	instance_type: string
	enabled: boolean
	sortOrder: number
	moduleVersionId: string | null
	updatePolicy: ConnectionUpdatePolicy // TODO - upgrade script
}

export interface ClientConnectionConfig {
	label: string
	instance_type: string
	moduleVersionId: string | null
	updatePolicy: ConnectionUpdatePolicy
	enabled: boolean
	sortOrder: number
	hasRecordActionsHandler: boolean
}

export enum ConnectionUpdatePolicy {
	Manual = 'manual',
	Stable = 'stable',
	Prerelease = 'prerelease',
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
