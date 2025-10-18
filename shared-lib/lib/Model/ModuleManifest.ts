import type { ModuleManifest } from '@companion-module/base'
import type { SurfaceModuleManifest } from '@companion-surface/base'

export interface ModuleManifestExt extends ModuleManifest {
	type: undefined | 'connection'
}
export type SomeModuleManifest = ModuleManifestExt | SurfaceModuleManifest
