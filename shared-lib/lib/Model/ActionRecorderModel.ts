import { ActionEntityModel } from './EntityModel.js'

export interface RecordSessionInfo {
	id: string
	connectionIds: string[]
	isRunning: boolean
	actionDelay: number
	actions: RecordActionEntityModel[]
}

export interface RecordSessionListInfo {
	connectionIds: string[]
}

// TODO - consolidate
export interface RecordActionEntityModel extends ActionEntityModel {
	delay: number
	uniquenessId: string | undefined
}
