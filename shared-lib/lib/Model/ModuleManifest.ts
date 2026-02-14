import type { ModuleManifest } from '@companion-module/base/manifest'
import type { ModuleManifest as ModuleManifestOld } from '@companion-module/base-old'
import type { SurfaceModuleManifest } from '@companion-surface/host'

export interface ModuleManifestOldExt extends ModuleManifestOld {
	type: undefined | 'connection-v1'
}
export type ModuleManifestExt = ModuleManifest
export type SomeModuleManifest = ModuleManifestExt | ModuleManifestOldExt | SurfaceModuleManifest
