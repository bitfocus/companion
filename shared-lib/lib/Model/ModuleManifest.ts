import type { ModuleManifest } from '@companion-module/base'
import type { SurfaceModuleManifest } from '@companion-surface/host'

export interface ModuleManifestExt extends ModuleManifest {
	type: undefined | 'connection'
}
export type SomeModuleManifest = ModuleManifestExt | SurfaceModuleManifest
