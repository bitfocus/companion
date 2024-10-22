import type { ModuleDisplayInfo } from '@companion-app/shared/Model/ModuleInfo.js'
import type { ModuleManifest } from '@companion-module/base'

export interface ModuleDirs {
	readonly bundledLegacyModulesDir: string
	readonly bundledModulesDir: string
	readonly customModulesDir: string
	readonly storeModulesDir: string
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
	releaseType: 'stable' | 'prerelease'
	versionId: string
	isBuiltin: boolean
}
export interface DevModuleVersionInfo extends ModuleVersionInfoBase {
	type: 'dev'
	isPackaged: boolean
}
export interface CustomModuleVersionInfo extends ModuleVersionInfoBase {
	type: 'custom'
	versionId: string
}
export type SomeModuleVersionInfo = ReleaseModuleVersionInfo | DevModuleVersionInfo | CustomModuleVersionInfo
