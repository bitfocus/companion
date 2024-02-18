import React from 'react'
import type { ObservableSet } from 'mobx'
import type { NotificationsManagerRef } from '../Components/Notifications.js'
import type { RecentlyUsedIdsStore } from './RecentlyUsedIdsStore.js'
import { CompanionSocketType } from '../util.js'
import { PagesStore } from './PagesStore.js'
import { EventDefinitionsStore } from './EventDefinitionsStore.js'

export const RootAppStoreContext = React.createContext<RootAppStore>(null as any) // TODO - fix this?

export interface RootAppStore {
	readonly socket: CompanionSocketType
	readonly notifier: React.RefObject<NotificationsManagerRef> // TODO - this is not good

	/** Currently running 'learn' callbacks */
	readonly activeLearns: ObservableSet<string>

	readonly recentlyAddedActions: RecentlyUsedIdsStore
	readonly recentlyAddedFeedbacks: RecentlyUsedIdsStore

	readonly eventDefinitions: EventDefinitionsStore

	readonly pages: PagesStore
}
