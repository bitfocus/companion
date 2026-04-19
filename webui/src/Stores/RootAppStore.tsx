import type { ObservableMap, ObservableSet } from 'mobx'
import { createContext } from 'react'
import type { NotificationsManagerRef } from '~/Components/Notifications.js'
import type { HelpModalRef } from '~/Instances/HelpModal.js'
import type { WhatsNewModalRef } from '~/WhatsNewModal/WhatsNew.js'
import type { ConnectionsStore } from './ConnectionsStore.js'
import type { EntityDefinitionsStore } from './EntityDefinitionsStore.js'
import type { EventDefinitionsStore } from './EventDefinitionsStore.js'
import type { ExpressionVariablesListStore } from './ExpressionVariablesListStore.js'
import type { InstanceStatusesStore } from './InstanceStatusesStore.js'
import type { ModuleInfoStore } from './ModuleInfoStore.js'
import type { PagesStore } from './PagesStore.js'
import type { SurfaceInstancesStore } from './SurfaceInstancesStore.js'
import type { SurfacesStore } from './SurfacesStore.js'
import type { TriggersListStore } from './TriggersListStore.js'
import type { UserConfigStore } from './UserConfigStore.js'
import type { VariablesStore } from './VariablesStore.js'
import type { ViewControlStore } from './ViewControlStore.js'

export const RootAppStoreContext = createContext<RootAppStore>(null as any) // TODO - fix this?

export interface RootAppStore {
	readonly notifier: NotificationsManagerRef
	readonly helpViewer: React.RefObject<HelpModalRef> // TODO - this is not good
	readonly whatsNewModal: React.RefObject<WhatsNewModalRef> // TODO - this is not good

	readonly modules: ModuleInfoStore

	readonly connections: ConnectionsStore
	readonly surfaceInstances: SurfaceInstancesStore
	readonly instanceStatuses: InstanceStatusesStore

	/** Currently running 'learn' callbacks */
	readonly activeLearns: ObservableSet<string>

	readonly entityDefinitions: EntityDefinitionsStore
	readonly eventDefinitions: EventDefinitionsStore

	readonly pages: PagesStore
	readonly surfaces: SurfacesStore
	readonly variablesStore: VariablesStore
	readonly expressionVariablesList: ExpressionVariablesListStore

	readonly triggersList: TriggersListStore

	readonly userConfig: UserConfigStore

	readonly moduleStoreRefreshProgress: ObservableMap<string | null, number>

	readonly showWizardEvent: EventTarget
	readonly showWizard: () => void

	readonly viewControl: ViewControlStore
}
