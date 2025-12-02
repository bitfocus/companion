import os from 'os'
import type { AppInfo } from '../Registry.js'
import type { operations as CompanionUpdatesApiOperations } from '@companion-app/shared/OpenApi/CompanionUpdates.js'

export type UpdateApiBody = CompanionUpdatesApiOperations['updates_post']['requestBody']['content']['application/json']

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
