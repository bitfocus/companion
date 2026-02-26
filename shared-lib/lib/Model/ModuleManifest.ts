import type { ModuleManifest, ModuleManifestRuntime } from '@companion-module/base/manifest'
import type {
	ModuleManifest as ModuleManifestOld,
	ModuleManifestRuntime as ModuleManifestOldRuntime,
} from '@companion-module/base-old'
import type { SurfaceModuleManifest } from '@companion-surface/host'

export type ModuleManifestOldExt = ModuleManifestOld
export interface ModuleManifestExt extends Omit<ModuleManifest, 'runtime'> {
	runtime: ModuleManifestRuntime | ModuleManifestOldRuntime
}
export type SomeModuleManifest = ModuleManifestExt | SurfaceModuleManifest
