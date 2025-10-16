import type { ClientInstanceConfigBase, ModuleInstanceType } from '@companion-app/shared/Model/Instance.js'
import type { InstanceEditPanelStore } from './InstanceEditPanelStore'
import type { ClientEditInstanceConfig } from '@companion-app/shared/Model/Common.js'

export interface InstanceEditPanelService<TConfig extends ClientInstanceConfigBase> {
	readonly moduleType: ModuleInstanceType
	readonly instanceId: string

	readonly moduleTypeDisplayName: string

	fetchConfig: () => Promise<ClientEditInstanceConfig | null>

	isCollectionEnabled: (collectionId: string | null) => boolean

	saveConfig: (instanceShouldBeRunning: boolean, panelStore: InstanceEditPanelStore<TConfig>) => Promise<string | null>

	deleteInstance: (currentLabel: string) => void

	closePanel: () => void
}
