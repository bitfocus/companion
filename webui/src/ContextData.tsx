import React, { useMemo, useRef } from 'react'
import { NotificationsManager, type NotificationsManagerRef } from '~/Components/Notifications.js'
import { useUserConfigSubscription } from './Hooks/useUserConfigSubscription.js'
import { usePagesInfoSubscription } from './Hooks/usePagesInfoSubscription.js'
import { useActiveLearnRequests } from './Hooks/useActiveLearnRequests.js'
import { RootAppStoreContext, type RootAppStore } from '~/Stores/RootAppStore.js'
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
import { HelpModal, type HelpModalRef } from './Instances/HelpModal.js'
import { ViewControlStore } from '~/Stores/ViewControlStore.js'
import { WhatsNewModal, type WhatsNewModalRef } from './WhatsNewModal.js'
import { useGenericCollectionsSubscription } from './Hooks/useCollectionsSubscription.js'
import { useCustomVariableCollectionsSubscription } from './Hooks/useCustomVariableCollectionsSubscription.js'
import { trpc } from './Resources/TRPC.js'
import { useEventDefinitions } from './Hooks/useEventDefinitions.js'
import { useExpressionVariablesListSubscription } from './Hooks/useExpressionVariablesListSubscription.js'
import { ExpressionVariablesListStore } from './Stores/ExpressionVariablesListStore.js'

interface ContextDataProps {
	children: (progressPercent: number, loadingComplete: boolean) => React.JSX.Element | React.JSX.Element[]
}

export function ContextData({ children }: Readonly<ContextDataProps>): React.JSX.Element {
	const notifierRef = useRef<NotificationsManagerRef>(null)
	const helpModalRef = useRef<HelpModalRef>(null)
	const whatsNewModalRef = useRef<WhatsNewModalRef>(null)

	const rootStore = useMemo(() => {
		const showWizardEvent = new EventTarget()

		const expressionVariablesList = new ExpressionVariablesListStore()

		return {
			notifier: notifierRef,
			helpViewer: helpModalRef,
			whatsNewModal: whatsNewModalRef,

			modules: new ModuleInfoStore(),
			connections: new ConnectionsStore(),

			activeLearns: observable.set(),

			entityDefinitions: new EntityDefinitionsStore(),
			eventDefinitions: new EventDefinitionsStore(),

			pages: new PagesStore(),
			surfaces: new SurfacesStore(),
			variablesStore: new VariablesStore(expressionVariablesList),
			expressionVariablesList,

			triggersList: new TriggersListStore(),

			userConfig: new UserConfigStore(),

			moduleStoreRefreshProgress: observable.map(),

			showWizardEvent,
			showWizard: () => showWizardEvent.dispatchEvent(new Event('show')),

			viewControl: new ViewControlStore(),
		} satisfies RootAppStore
	}, [])

	const actionDefinitionsReady = useEntityDefinitionsSubscription(
		rootStore.entityDefinitions.actions,
		trpc.instances.definitions.actions
	)
	const feedbackDefinitionsReady = useEntityDefinitionsSubscription(
		rootStore.entityDefinitions.feedbacks,
		trpc.instances.definitions.feedbacks
	)
	const moduleInfoReady = useModuleInfoSubscription(rootStore.modules)
	const moduleStoreReady = useModuleStoreListSubscription(rootStore.modules)
	const connectionsReady = useConnectionsConfigSubscription(rootStore.connections)
	const connectionGroupsReady = useGenericCollectionsSubscription(
		rootStore.connections,
		trpc.instances.connections.collections.watchQuery,
		undefined
	)
	const triggersListReady = useTriggersListSubscription(rootStore.triggersList)
	const triggerGroupsReady = useGenericCollectionsSubscription(
		rootStore.triggersList,
		trpc.controls.triggers.collections.watchQuery,
		undefined
	)
	const { ready: pagesReady } = usePagesInfoSubscription(rootStore.pages)
	const { ready: userConfigReady } = useUserConfigSubscription(rootStore.userConfig)
	const surfacesReady = useSurfacesSubscription(rootStore.surfaces)
	const outboundSurfacesReady = useOutboundSurfacesSubscription(rootStore.surfaces)
	const outboundSurfacesCollectionsReady = useGenericCollectionsSubscription(
		{
			resetCollections: rootStore.surfaces.resetOutboundSurfaceCollections.bind(rootStore.surfaces),
			rootCollections: rootStore.surfaces.outboundSurfaceRootCollections.bind(rootStore.surfaces),
		},
		trpc.surfaces.outbound.collections.watchQuery,
		undefined
	)
	const variablesReady = useVariablesSubscription(rootStore.variablesStore)
	const customVariablesReady = useCustomVariablesSubscription(rootStore.variablesStore)
	const customVariableCollectionsReady = useCustomVariableCollectionsSubscription(rootStore.variablesStore)
	const expressionVariablesReady = useExpressionVariablesListSubscription(rootStore.expressionVariablesList)
	const expressionVariableCollectionsReady = useGenericCollectionsSubscription(
		rootStore.expressionVariablesList,
		trpc.controls.expressionVariables.collections.watchQuery,
		undefined
	)
	const moduleStoreProgressReady = useModuleStoreRefreshProgressSubscription(rootStore.moduleStoreRefreshProgress)
	const entityDefinitionsReady = useEventDefinitions(rootStore.eventDefinitions)
	const activeLearnRequestsReady = useActiveLearnRequests(rootStore.activeLearns)

	const steps: boolean[] = [
		moduleInfoReady,
		moduleStoreReady,
		connectionsReady,
		connectionGroupsReady,
		variablesReady,
		actionDefinitionsReady,
		feedbackDefinitionsReady,
		customVariablesReady,
		customVariableCollectionsReady,
		expressionVariablesReady,
		expressionVariableCollectionsReady,
		userConfigReady,
		surfacesReady,
		outboundSurfacesReady,
		outboundSurfacesCollectionsReady,
		pagesReady,
		triggersListReady,
		triggerGroupsReady,
		entityDefinitionsReady,
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
