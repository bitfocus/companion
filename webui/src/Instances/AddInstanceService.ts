import type { ModuleInstanceType } from '@companion-app/shared/Model/Instance.js'
import type { FuzzyProduct } from '~/Hooks/useFilteredProducts'

export interface AddInstanceService {
	readonly moduleType: ModuleInstanceType

	closeAddInstance: () => void

	openConfigureInstance: (instanceId: string) => void

	performAddInstance: (moduleInfo: FuzzyProduct, label: string, versionId: string) => Promise<string>

	findNextLabel(moduleInfo: FuzzyProduct): string
}
