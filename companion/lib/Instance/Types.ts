import type { ModuleInstanceType } from '@companion-app/shared/Model/Instance.js'
import type { ModuleDisplayInfo } from '@companion-app/shared/Model/ModuleInfo.js'
import type { ModuleManifestExt } from '@companion-app/shared/Model/ModuleManifest.js'

export type SomeModuleVersionInfo = ConnectionModuleVersionInfo // | SurfaceModuleVersionInfo

export interface ModuleVersionInfoBase {
	versionId: string // 'dev' or a semver version
	basePath: string
	helpPath: string | null
	isPackaged: boolean
	isBeta: boolean
	display: ModuleDisplayInfo
}

// export interface SurfaceModuleVersionInfo extends ModuleVersionInfoBase {
// 	type: ModuleInstanceType.Surface
// 	manifest: SurfaceModuleManifest
// 	isLegacy: false
// }

export interface ConnectionModuleVersionInfo extends ModuleVersionInfoBase {
	type: ModuleInstanceType.Connection
	manifest: ModuleManifestExt
	isLegacy: boolean
}
