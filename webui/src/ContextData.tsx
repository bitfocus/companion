import React, { useContext, useEffect, useMemo, useRef, useState } from 'react'
import { SocketContext } from './util.js'
import { NotificationsManager, NotificationsManagerRef } from './Components/Notifications.js'
import { useUserConfigSubscription } from './Hooks/useUserConfigSubscription.js'
import { usePagesInfoSubscription } from './Hooks/usePagesInfoSubscription.js'
import { useActionDefinitionsSubscription } from './Hooks/useActionDefinitionsSubscription.js'
import { useActiveLearnRequests } from './_Model/ActiveLearn.js'
import { RootAppStore, RootAppStoreContext } from './Stores/RootAppStore.js'
import { RecentlyUsedIdsStore } from './Stores/RecentlyUsedIdsStore.js'
import { observable } from 'mobx'
import { PagesStore } from './Stores/PagesStore.js'
import { EventDefinitionsStore } from './Stores/EventDefinitionsStore.js'
import { ActionDefinitionsStore } from './Stores/ActionDefinitionsStore.js'
import { FeedbackDefinitionsStore } from './Stores/FeedbackDefinitionsStore.js'
import { useFeedbackDefinitionsSubscription } from './Hooks/useFeedbackDefinitionsSubscription.js'
import { ModuleInfoStore } from './Stores/ModuleInfoStore.js'
import { useModuleInfoSubscription } from './Hooks/useModuleInfoSubscription.js'
import { TriggersListStore } from './Stores/TriggersListStore.js'
import { useTriggersListSubscription } from './Hooks/useTriggersListSubscription.js'
import { useSurfacesSubscription } from './Hooks/useSurfacesSubscription.js'
import { SurfacesStore } from './Stores/SurfacesStore.js'
import { UserConfigStore } from './Stores/UserConfigStore.js'
import { VariablesStore } from './Stores/VariablesStore.js'
import { useCustomVariablesSubscription } from './Hooks/useCustomVariablesSubscription.js'
import { useVariablesSubscription } from './Hooks/useVariablesSubscription.js'
import { useOutboundSurfacesSubscription } from './Hooks/useOutboundSurfacesSubscription.js'
import { ConnectionsStore } from './Stores/ConnectionsStore.js'
import { useConnectionsConfigSubscription } from './Hooks/useConnectionsConfigSubscription.js'
import { WhatsNewModal, WhatsNewModalRef } from './WhatsNewModal.js'

interface ContextDataProps {
	children: (progressPercent: number, loadingComplete: boolean) => React.JSX.Element | React.JSX.Element[]
}

export function ContextData({ children }: Readonly<ContextDataProps>) {
	const socket = useContext(SocketContext)

	const notifierRef = useRef<NotificationsManagerRef>(null)
	const whatsNewModalRef = useRef<WhatsNewModalRef>(null)

	const rootStore = useMemo(() => {
		return {
			socket,
			notifier: notifierRef,
			whatsNewModal: whatsNewModalRef,

			modules: new ModuleInfoStore(),
			connections: new ConnectionsStore(),

			activeLearns: observable.set(),

			recentlyAddedActions: new RecentlyUsedIdsStore('recent_actions', 20),
			recentlyAddedFeedbacks: new RecentlyUsedIdsStore('recent_feedbacks', 20),

			actionDefinitions: new ActionDefinitionsStore(),
			eventDefinitions: new EventDefinitionsStore(),
			feedbackDefinitions: new FeedbackDefinitionsStore(),

			pages: new PagesStore(),
			surfaces: new SurfacesStore(),
			variablesStore: new VariablesStore(),

			triggersList: new TriggersListStore(),

			userConfig: new UserConfigStore(),
		} satisfies RootAppStore
	}, [socket])

	const [loadedEventDefinitions, setLoadedEventDefinitions] = useState(false)

	const actionDefinitionsReady = useActionDefinitionsSubscription(socket, rootStore.actionDefinitions)
	const feedbackDefinitionsReady = useFeedbackDefinitionsSubscription(socket, rootStore.feedbackDefinitions)
	const moduleInfoReady = useModuleInfoSubscription(socket, rootStore.modules)
	const connectionsReady = useConnectionsConfigSubscription(socket, rootStore.connections)
	const triggersListReady = useTriggersListSubscription(socket, rootStore.triggersList)
	const pagesReady = usePagesInfoSubscription(socket, rootStore.pages)
	const userConfigReady = useUserConfigSubscription(socket, rootStore.userConfig)
	const surfacesReady = useSurfacesSubscription(socket, rootStore.surfaces)
	const outboundSurfacesReady = useOutboundSurfacesSubscription(socket, rootStore.surfaces)
	const variablesReady = useVariablesSubscription(socket, rootStore.variablesStore)
	const customVariablesReady = useCustomVariablesSubscription(socket, rootStore.variablesStore)

	useEffect(() => {
		if (socket) {
			socket
				.emitPromise('event-definitions:get', [])
				.then((definitions) => {
					setLoadedEventDefinitions(true)
					rootStore.eventDefinitions.setDefinitions(definitions)
				})
				.catch((e) => {
					console.error('Failed to load event definitions', e)
				})
		}
	}, [socket, rootStore])

	const activeLearnRequestsReady = useActiveLearnRequests(socket, rootStore.activeLearns)

	const steps: boolean[] = [
		loadedEventDefinitions,
		moduleInfoReady,
		connectionsReady,
		variablesReady,
		actionDefinitionsReady,
		feedbackDefinitionsReady,
		customVariablesReady,
		userConfigReady,
		surfacesReady,
		outboundSurfacesReady,
		pagesReady,
		triggersListReady,
		activeLearnRequestsReady,
	]
	const completedSteps = steps.filter((s) => !!s)

	const progressPercent = (completedSteps.length / steps.length) * 100

	return (
		<RootAppStoreContext.Provider value={rootStore}>
			<NotificationsManager ref={notifierRef} />
			<WhatsNewModal ref={whatsNewModalRef} />

			{children(progressPercent, completedSteps.length === steps.length)}
		</RootAppStoreContext.Provider>
	)
}
