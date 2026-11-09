import type { ObjectPatch } from '../Diff.js'
import type { ActionEntityModel } from './EntityModel.js'

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

export type RecordSessionUpdate =
	| {
			type: 'init'
			session: RecordSessionInfo
	  }
	| {
			type: 'patch'
			patch: ObjectPatch<RecordSessionInfo>
	  }
	| {
			type: 'remove'
			// patch: ObjectPatch<RecordSessionInfo>
	  }
