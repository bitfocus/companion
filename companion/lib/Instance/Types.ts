import type { ModuleDisplayInfo } from '@companion-app/shared/Model/ModuleInfo.js'
import type { ModuleManifest } from '@companion-module/base'

export interface ModuleVersionInfo {
	versionId: string // 'dev' or a semver version
	basePath: string
	helpPath: string | null
	display: ModuleDisplayInfo
	manifest: ModuleManifest
	isPackaged: boolean
	isBeta: boolean
	isLegacy: boolean
}
