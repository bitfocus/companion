import os from 'node:os'
import type { UpdatesPostData } from '@companion-app/shared/OpenApi/CompanionUpdates/index.js'
import type { AppInfo } from '../Registry.js'

export type UpdateApiBody = UpdatesPostData['body']

export function compileUpdatePayload(appInfo: AppInfo): UpdateApiBody {
	return {
		// Information about the computer asking for a update. This way
		// we can filter out certain kinds of OS/versions if there
		// is known bugs etc.
		id: appInfo.machineId,

		app: {
			name: 'companion',
			version: appInfo.appVersion,
			build: appInfo.appBuild,
		},
		os: {
			platform: os.platform(),
			arch: os.arch(),
			release: os.release(),
		},
	}
}
