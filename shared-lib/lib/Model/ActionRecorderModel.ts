import type { ActionEntityModel } from './EntityModel.js'
import type jsonPatch from 'fast-json-patch'

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
			patch: jsonPatch.Operation<RecordSessionInfo>[]
	  }
	| {
			type: 'remove'
			// patch: jsonPatch.Operation<RecordSessionInfo>[]
	  }
