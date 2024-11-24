import type { ModuleDisplayInfo } from '@companion-app/shared/Model/ModuleInfo.js'
import type { ModuleManifest } from '@companion-module/base'

export interface ModuleVersionInfoBase {
	basePath: string
	helpPath: string | null
	display: ModuleDisplayInfo
	manifest: ModuleManifest
	isPackaged: boolean // TODO - is this needed?
	isBeta: boolean // TODO - is this needed?
}

export interface ReleaseModuleVersionInfo extends ModuleVersionInfoBase {
	type: 'release'
	versionId: string
	isBeta: boolean
}
export interface DevModuleVersionInfo extends ModuleVersionInfoBase {
	type: 'dev'
	isPackaged: boolean
}
export type SomeModuleVersionInfo = ReleaseModuleVersionInfo | DevModuleVersionInfo
