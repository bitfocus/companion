import React, { useContext, useEffect, useMemo, useRef, useState } from 'react'
import { ConnectionsContext, socketEmitPromise, SocketContext } from './util.js'
import { NotificationsManager, NotificationsManagerRef } from './Components/Notifications.js'
import { cloneDeep } from 'lodash-es'
import jsonPatch, { Operation as JsonPatchOperation } from 'fast-json-patch'
import { useUserConfigSubscription } from './Hooks/useUserConfigSubscription.js'
import { usePagesInfoSubscription } from './Hooks/usePagesInfoSubscription.js'
import { useActionDefinitionsSubscription } from './Hooks/useActionDefinitionsSubscription.js'
import type { ClientConnectionConfig } from '@companion-app/shared/Model/Common.js'
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

interface ContextDataProps {
	children: (progressPercent: number, loadingComplete: boolean) => React.JSX.Element | React.JSX.Element[]
}

export function ContextData({ children }: Readonly<ContextDataProps>) {
	const socket = useContext(SocketContext)

	const notifierRef = useRef<NotificationsManagerRef>(null)

	const rootStore = useMemo(() => {
		return {
			socket,
			notifier: notifierRef,

			modules: new ModuleInfoStore(),

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

	const [connections, setConnections] = useState<Record<string, ClientConnectionConfig> | null>(null)

	const [loadedEventDefinitions, setLoadedEventDefinitions] = useState(false)

	const actionDefinitionsReady = useActionDefinitionsSubscription(socket, rootStore.actionDefinitions)
	const feedbackDefinitionsReady = useFeedbackDefinitionsSubscription(socket, rootStore.feedbackDefinitions)
	const moduleInfoReady = useModuleInfoSubscription(socket, rootStore.modules)
	const triggersListReady = useTriggersListSubscription(socket, rootStore.triggersList)
	const pagesReady = usePagesInfoSubscription(socket, rootStore.pages)
	const userConfigReady = useUserConfigSubscription(socket, rootStore.userConfig)
	const surfacesReady = useSurfacesSubscription(socket, rootStore.surfaces)
	const variablesReady = useVariablesSubscription(socket, rootStore.variablesStore)
	const customVariablesReady = useCustomVariablesSubscription(socket, rootStore.variablesStore)

	useEffect(() => {
		if (socket) {
			socketEmitPromise(socket, 'event-definitions:get', [])
				.then((definitions) => {
					setLoadedEventDefinitions(true)
					rootStore.eventDefinitions.setDefinitions(definitions)
				})
				.catch((e) => {
					console.error('Failed to load event definitions', e)
				})

			socketEmitPromise(socket, 'connections:subscribe', [])
				.then((connections) => {
					setConnections(connections)
				})
				.catch((e) => {
					console.error('Failed to load instances list:', e)
					setConnections(null)
				})

			const patchInstances = (patch: JsonPatchOperation[] | false) => {
				setConnections((oldConnections) => {
					if (patch === false) {
						return {}
					} else {
						return jsonPatch.applyPatch(cloneDeep(oldConnections) || {}, patch).newDocument
					}
				})
			}
			socket.on('connections:patch', patchInstances)

			return () => {
				socket.off('connections:patch', patchInstances)

				socketEmitPromise(socket, 'variable-definitions:unsubscribe', []).catch((e) => {
					console.error('Failed to unsubscribe to variable definitions list', e)
				})
				socketEmitPromise(socket, 'connections:unsubscribe', []).catch((e) => {
					console.error('Failed to unsubscribe from instances list:', e)
				})
				socketEmitPromise(socket, 'surfaces:unsubscribe', []).catch((e) => {
					console.error('Failed to unsubscribe from surfaces', e)
				})
				socketEmitPromise(socket, 'custom-variables:unsubscribe', []).catch((e) => {
					console.error('Failed to unsubscribe from custom variables', e)
				})
			}
		} else {
			return
		}
	}, [socket])

	const activeLearnRequestsReady = useActiveLearnRequests(socket, rootStore.activeLearns)

	const steps: boolean[] = [
		loadedEventDefinitions,
		connections != null,
		moduleInfoReady,
		variablesReady,
		actionDefinitionsReady,
		feedbackDefinitionsReady,
		customVariablesReady,
		userConfigReady,
		surfacesReady,
		pagesReady,
		triggersListReady,
		activeLearnRequestsReady,
	]
	const completedSteps = steps.filter((s) => !!s)

	const progressPercent = (completedSteps.length / steps.length) * 100

	return (
		<RootAppStoreContext.Provider value={rootStore}>
			<ConnectionsContext.Provider value={connections!}>
				<NotificationsManager ref={notifierRef} />
				{children(progressPercent, completedSteps.length === steps.length)}
			</ConnectionsContext.Provider>
		</RootAppStoreContext.Provider>
	)
}
