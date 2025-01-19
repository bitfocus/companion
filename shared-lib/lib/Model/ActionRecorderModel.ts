export interface RecordSessionInfo {
	id: string
	connectionIds: string[]
	isRunning: boolean
	actions: RecordActionTmp[]
}

export interface RecordSessionListInfo {
	connectionIds: string[]
}

// TODO - consolidate
export interface RecordActionTmp {
	id: string
	instance: string
	action: string
	options: Record<string, any>
	uniquenessId: string | undefined
}
