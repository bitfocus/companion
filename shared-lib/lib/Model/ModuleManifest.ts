import type { ModuleManifest } from '@companion-module/base'

export interface ModuleManifestExt extends ModuleManifest {
	type: undefined | 'connection'
}
export type SomeModuleManifest = ModuleManifestExt //| SurfaceModuleManifest
