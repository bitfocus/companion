import type { ClientEditInstanceConfigState } from '@companion-app/shared/Model/Common.js'
import type { ClientInstanceConfigBase, ModuleInstanceType } from '@companion-app/shared/Model/Instance.js'
import type { InstanceEditPanelStore } from './InstanceEditPanelStore'

export interface InstanceConfigSubscriptionHandlers {
	onStarted?: () => void
	onData: (state: ClientEditInstanceConfigState) => void
	onError?: (error: unknown) => void
}

export interface InstanceEditPanelService<TConfig extends ClientInstanceConfigBase> {
	readonly moduleType: ModuleInstanceType
	readonly instanceId: string

	readonly moduleTypeDisplayName: string

	/**
	 * Build the tRPC subscription options that stream the config-fields editor state for this instance.
	 * The generic panel passes the result straight to `useSubscription`.
	 */
	watchConfig: (handlers: InstanceConfigSubscriptionHandlers) => any

	saveConfig: (panelStore: InstanceEditPanelStore<TConfig>) => Promise<string | null>

	/**
	 * Change the module and/or version for this instance. Returns an error message to display, or null
	 * on success. Routed to the connection or surface endpoint by the concrete service implementation.
	 */
	setModuleAndVersion: (moduleId: string, versionId: string | null) => Promise<string | null>

	deleteInstance: (currentLabel: string) => void

	closePanel: () => void
}
