import type { ModuleDisplayInfo } from '@companion-app/shared/Model/ModuleInfo.js'
import type { ModuleManifest } from '@companion-module/base'

export interface ModuleVersionInfoBase {
	basePath: string
	helpPath: string | null
	display: ModuleDisplayInfo
	manifest: ModuleManifest
	isPackaged: boolean
	isBeta: boolean
}

export interface ReleaseModuleVersionInfo extends ModuleVersionInfoBase {
	type: 'release'
	versionId: string
	isBeta: boolean
	isPackaged: true
}
export interface DevModuleVersionInfo extends ModuleVersionInfoBase {
	type: 'dev'
	isPackaged: boolean
	isBeta: false
}
export type SomeModuleVersionInfo = ReleaseModuleVersionInfo | DevModuleVersionInfo
