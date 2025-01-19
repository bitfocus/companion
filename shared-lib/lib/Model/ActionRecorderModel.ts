import { ActionEntityModel } from './EntityModel.js'

export interface RecordSessionInfo {
	id: string
	connectionIds: string[]
	isRunning: boolean
	actions: RecordActionEntityModel[]
}

export interface RecordSessionListInfo {
	connectionIds: string[]
}

export interface RecordActionEntityModel extends ActionEntityModel {
	uniquenessId: string | undefined
}
