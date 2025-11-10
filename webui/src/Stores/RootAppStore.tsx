import React from 'react'
import type { ObservableMap, ObservableSet } from 'mobx'
import type { NotificationsManagerRef } from '~/Components/Notifications.js'
import type { PagesStore } from './PagesStore.js'
import type { EntityDefinitionsStore } from './EntityDefinitionsStore.js'
import type { EventDefinitionsStore } from './EventDefinitionsStore.js'
import type { ModuleInfoStore } from './ModuleInfoStore.js'
import type { TriggersListStore } from './TriggersListStore.js'
import type { SurfacesStore } from './SurfacesStore.js'
import type { UserConfigStore } from './UserConfigStore.js'
import type { VariablesStore } from './VariablesStore.js'
import type { ConnectionsStore } from './ConnectionsStore.js'
import type { HelpModalRef } from '~/Instances/HelpModal.js'
import type { ViewControlStore } from './ViewControlStore.js'
import type { WhatsNewModalRef } from '~/WhatsNewModal/WhatsNew.js'
import type { ExpressionVariablesListStore } from './ExpressionVariablesListStore.js'

export const RootAppStoreContext = React.createContext<RootAppStore>(null as any) // TODO - fix this?

export interface RootAppStore {
	readonly notifier: NotificationsManagerRef
	readonly helpViewer: React.RefObject<HelpModalRef> // TODO - this is not good
	readonly whatsNewModal: React.RefObject<WhatsNewModalRef> // TODO - this is not good

	readonly modules: ModuleInfoStore
	readonly connections: ConnectionsStore

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
