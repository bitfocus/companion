import type { ModuleDisplayInfo } from '@companion-app/shared/Model/ModuleInfo.js'
import type { ModuleManifest } from '@companion-module/base'

export interface ModuleDirs {
	readonly bundledLegacyModulesDir: string
	readonly bundledModulesDir: string
	readonly installedModulesDir: string
}

export interface ModuleVersionInfoBase {
	basePath: string
	helpPath: string | null
	display: ModuleDisplayInfo
	manifest: ModuleManifest
	isPackaged: boolean
	isPrerelease: boolean
}

export interface ReleaseModuleVersionInfo extends ModuleVersionInfoBase {
	type: 'release'
	versionId: string
	isPrerelease: boolean
	isBuiltin: boolean
}
export interface DevModuleVersionInfo extends ModuleVersionInfoBase {
	type: 'dev'
	isPackaged: boolean
}
export type SomeModuleVersionInfo = ReleaseModuleVersionInfo | DevModuleVersionInfo
