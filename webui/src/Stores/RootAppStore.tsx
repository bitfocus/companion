import React from 'react'
import type { ObservableSet } from 'mobx'
import type { Socket } from 'socket.io-client'
import type { NotificationsManagerRef } from '../Components/Notifications.js'
import type { RecentlyUsedIdsStore } from './RecentlyUsedIdsStore.js'

export const RootAppStoreContext = React.createContext<RootAppStore>(null as any) // TODO - fix this?

export interface RootAppStore {
	readonly socket: Socket
	readonly notifier: React.RefObject<NotificationsManagerRef> // TODO - this is not good

	/** Currently running 'learn' callbacks */
	readonly activeLearns: ObservableSet<string>

	readonly recentlyAddedActions: RecentlyUsedIdsStore
	readonly recentlyAddedFeedbacks: RecentlyUsedIdsStore
}
