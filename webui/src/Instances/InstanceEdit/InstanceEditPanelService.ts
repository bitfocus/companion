import type { ClientInstanceConfigBase, ModuleInstanceType } from '@companion-app/shared/Model/Instance.js'
import type { InstanceEditPanelStore } from './InstanceEditPanelStore'

export interface InstanceEditPanelService {
	readonly moduleType: ModuleInstanceType
	readonly instanceId: string

	readonly moduleTypeDisplayName: string

	isCollectionEnabled: (collectionId: string | null) => boolean

	saveConfig: (
		instanceShouldBeRunning: boolean,
		panelStore: InstanceEditPanelStore<ClientInstanceConfigBase>
	) => Promise<string | null>

	deleteInstance: (currentLabel: string) => void

	closePanel: () => void
}
