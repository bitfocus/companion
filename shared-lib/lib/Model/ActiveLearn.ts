export type ActiveLearnUpdate = ActiveLearnUpdateInit | ActiveLearnUpdateAdd | ActiveLearnUpdateRemove

export interface ActiveLearnUpdateInit {
	type: 'init'
	ids: string[]
}
export interface ActiveLearnUpdateAdd {
	type: 'add'
	id: string
}
export interface ActiveLearnUpdateRemove {
	type: 'remove'
	id: string
}
