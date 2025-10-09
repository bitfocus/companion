export interface InstanceStatusEntry {
	category: string | null
	level: string | null
	message: string | null
}

export type InstanceStatusUpdate =
	| InstanceStatusUpdateInitOp
	| InstanceStatusUpdateRemoveOp
	| InstanceStatusUpdateUpdateOp

export interface InstanceStatusUpdateInitOp {
	type: 'init'
	statuses: Record<string, InstanceStatusEntry>
}
export interface InstanceStatusUpdateRemoveOp {
	type: 'remove'
	instanceId: string
}
export interface InstanceStatusUpdateUpdateOp {
	type: 'update'
	instanceId: string

	status: InstanceStatusEntry
}
