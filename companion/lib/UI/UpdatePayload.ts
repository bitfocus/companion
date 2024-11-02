import os from 'os'
import type { AppInfo } from '../Registry.js'

export function compileUpdatePayload(appInfo: AppInfo): Record<string, any> {
	const x = new Date()
	const offset = -x.getTimezoneOffset()
	const off = (offset >= 0 ? '+' : '-') + offset / 60

	return {
		// Information about the computer asking for a update. This way
		// we can filter out certain kinds of OS/versions if there
		// is known bugs etc.
		app_name: 'companion',
		app_build: appInfo.appBuild,
		app_version: appInfo.appVersion,
		arch: os.arch(),
		tz: off,
		cpus: os.cpus(),
		platform: os.platform(),
		release: os.release(),
		type: os.type(),
		id: appInfo.machineId,
	}
}
