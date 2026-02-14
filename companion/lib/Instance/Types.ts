import type { ModuleInstanceType } from '@companion-app/shared/Model/Instance.js'
import type { ModuleDisplayInfo } from '@companion-app/shared/Model/ModuleInfo.js'
import type { ModuleManifestExt, ModuleManifestOldExt } from '@companion-app/shared/Model/ModuleManifest.js'
import type { SurfaceModuleManifest } from '@companion-surface/host'

export type SomeModuleVersionInfo = ConnectionModuleVersionInfo | SurfaceModuleVersionInfo

export interface ModuleVersionInfoBase {
	versionId: string // 'dev', 'builtin', or a semver version
	basePath: string
	helpPath: string | null
	isPackaged: boolean
	isBeta: boolean
	display: ModuleDisplayInfo
}

export interface SurfaceModuleVersionInfo extends ModuleVersionInfoBase {
	type: ModuleInstanceType.Surface
	manifest: SurfaceModuleManifest
	isLegacy: false
	isBuiltin: boolean
}

export interface ConnectionModuleVersionInfo extends ModuleVersionInfoBase {
	type: ModuleInstanceType.Connection
	manifest: ModuleManifestExt | ModuleManifestOldExt
	isLegacy: boolean
}
