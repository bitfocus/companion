import type { ModuleInstanceType } from '@companion-app/shared/Model/Instance.js'
import { FuzzyProduct } from '~/Hooks/useFilteredProducts'
import type { ModuleInfoStore } from '~/Stores/ModuleInfoStore'

export interface AddInstanceService {
	readonly moduleType: ModuleInstanceType

	readonly modules: ModuleInfoStore

	closeAddInstance: () => void

	openConfigureInstance: (instanceId: string) => void

	performAddInstance: (moduleInfo: FuzzyProduct, label: string, versionId: string) => Promise<string>

	findNextLabel(moduleInfo: FuzzyProduct): string
}
