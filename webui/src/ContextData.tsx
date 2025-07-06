import React, { useContext, useEffect, useMemo, useRef, useState } from 'react'
import { SocketContext } from '~/util.js'
import { NotificationsManager, NotificationsManagerRef } from '~/Components/Notifications.js'
import { useUserConfigSubscription } from './Hooks/useUserConfigSubscription.js'
import { usePagesInfoSubscription } from './Hooks/usePagesInfoSubscription.js'
import { useActiveLearnRequests } from './_Model/ActiveLearn.js'
import { RootAppStore, RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { observable } from 'mobx'
import { PagesStore } from '~/Stores/PagesStore.js'
import { EventDefinitionsStore } from '~/Stores/EventDefinitionsStore.js'
import { EntityDefinitionsStore } from '~/Stores/EntityDefinitionsStore.js'
import { useEntityDefinitionsSubscription } from './Hooks/useEntityDefinitionsSubscription.js'
import { ModuleInfoStore } from '~/Stores/ModuleInfoStore.js'
import { useModuleInfoSubscription } from './Hooks/useModuleInfoSubscription.js'
import { TriggersListStore } from '~/Stores/TriggersListStore.js'
import { useTriggersListSubscription } from './Hooks/useTriggersListSubscription.js'
import { useSurfacesSubscription } from './Hooks/useSurfacesSubscription.js'
import { SurfacesStore } from '~/Stores/SurfacesStore.js'
import { UserConfigStore } from '~/Stores/UserConfigStore.js'
import { VariablesStore } from '~/Stores/VariablesStore.js'
import { useCustomVariablesSubscription } from './Hooks/useCustomVariablesSubscription.js'
import { useVariablesSubscription } from './Hooks/useVariablesSubscription.js'
import { useOutboundSurfacesSubscription } from './Hooks/useOutboundSurfacesSubscription.js'
import { ConnectionsStore } from '~/Stores/ConnectionsStore.js'
import { useConnectionsConfigSubscription } from './Hooks/useConnectionsConfigSubscription.js'
import { useModuleStoreRefreshProgressSubscription } from './Hooks/useModuleStoreRefreshProgress.js'
import { useModuleStoreListSubscription } from './Hooks/useModuleStoreListSubscription.js'
import { HelpModal, HelpModalRef } from './Connections/HelpModal.js'
import { ViewControlStore } from '~/Stores/ViewControlStore.js'
import { WhatsNewModal, WhatsNewModalRef } from './WhatsNewModal.js'
import { useGenericCollectionsSubscription } from './Hooks/useCollectionsSubscription.js'
import { useCustomVariableCollectionsSubscription } from './Hooks/useCustomVariableCollectionsSubscription.js'
import { trpc } from './TRPC.js'

interface ContextDataProps {
	children: (progressPercent: number, loadingComplete: boolean) => React.JSX.Element | React.JSX.Element[]
}

export function ContextData({ children }: Readonly<ContextDataProps>): React.JSX.Element {
	const socket = useContext(SocketContext)

	const notifierRef = useRef<NotificationsManagerRef>(null)
	const helpModalRef = useRef<HelpModalRef>(null)
	const whatsNewModalRef = useRef<WhatsNewModalRef>(null)

	const rootStore = useMemo(() => {
		const showWizardEvent = new EventTarget()

		return {
			socket,
			notifier: notifierRef,
			helpViewer: helpModalRef,
			whatsNewModal: whatsNewModalRef,

			modules: new ModuleInfoStore(socket),
			connections: new ConnectionsStore(),

			activeLearns: observable.set(),

			entityDefinitions: new EntityDefinitionsStore(),
			eventDefinitions: new EventDefinitionsStore(),

			pages: new PagesStore(),
			surfaces: new SurfacesStore(),
			variablesStore: new VariablesStore(),

			triggersList: new TriggersListStore(),

			userConfig: new UserConfigStore(),

			moduleStoreRefreshProgress: observable.map(),

			showWizardEvent,
			showWizard: () => showWizardEvent.dispatchEvent(new Event('show')),

			viewControl: new ViewControlStore(),
		} satisfies RootAppStore
	}, [socket])

	const [loadedEventDefinitions, setLoadedEventDefinitions] = useState(false)

	const actionDefinitionsReady = useEntityDefinitionsSubscription(socket, rootStore.entityDefinitions.actions)
	const feedbackDefinitionsReady = useEntityDefinitionsSubscription(socket, rootStore.entityDefinitions.feedbacks)
	const moduleInfoReady = useModuleInfoSubscription(socket, rootStore.modules)
	const moduleStoreReady = useModuleStoreListSubscription(socket, rootStore.modules)
	const connectionsReady = useConnectionsConfigSubscription(socket, rootStore.connections)
	const connectionGroupsReady = useGenericCollectionsSubscription(
		rootStore.connections,
		trpc.connections.collections.watchQuery,
		undefined
	)
	const triggersListReady = useTriggersListSubscription(socket, rootStore.triggersList)
	const triggerGroupsReady = useGenericCollectionsSubscription(
		rootStore.triggersList,
		trpc.controls.triggerCollections.watchQuery,
		undefined
	)
	const pagesReady = usePagesInfoSubscription(socket, rootStore.pages)
	const userConfigReady = useUserConfigSubscription(socket, rootStore.userConfig)
	const surfacesReady = useSurfacesSubscription(socket, rootStore.surfaces)
	const outboundSurfacesReady = useOutboundSurfacesSubscription(socket, rootStore.surfaces)
	const variablesReady = useVariablesSubscription(socket, rootStore.variablesStore)
	const customVariablesReady = useCustomVariablesSubscription(socket, rootStore.variablesStore)
	const customVariableCollectionsReady = useCustomVariableCollectionsSubscription(socket, rootStore.variablesStore)
	const moduleStoreProgressReady = useModuleStoreRefreshProgressSubscription(
		socket,
		rootStore.moduleStoreRefreshProgress
	)

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
		moduleStoreReady,
		connectionsReady,
		connectionGroupsReady,
		variablesReady,
		actionDefinitionsReady,
		feedbackDefinitionsReady,
		customVariablesReady,
		customVariableCollectionsReady,
		userConfigReady,
		surfacesReady,
		outboundSurfacesReady,
		pagesReady,
		triggersListReady,
		triggerGroupsReady,
		activeLearnRequestsReady,
		moduleStoreProgressReady,
	]
	const completedSteps = steps.filter((s) => !!s)

	const progressPercent = (completedSteps.length / steps.length) * 100

	return (
		<RootAppStoreContext.Provider value={rootStore}>
			<NotificationsManager ref={notifierRef} />
			<HelpModal ref={helpModalRef} />
			<WhatsNewModal ref={whatsNewModalRef} />

			{children(progressPercent, completedSteps.length === steps.length)}
		</RootAppStoreContext.Provider>
	)
}
