export interface RecordSessionInfo {
	id: string
	connectionIds: string[]
	isRunning: boolean
	actionDelay: number
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
	delay: number
	options: Record<string, any>
	uniquenessId: string | undefined
}
