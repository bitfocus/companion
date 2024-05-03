import React, { useContext, useEffect, useMemo, useRef, useState } from 'react'
import {
	applyPatchOrReplaceSubObject,
	ConnectionsContext,
	VariableDefinitionsContext,
	CustomVariableDefinitionsContext,
	socketEmitPromise,
	applyPatchOrReplaceObject,
	SocketContext,
} from './util.js'
import { NotificationsManager, NotificationsManagerRef } from './Components/Notifications.js'
import { cloneDeep } from 'lodash-es'
import jsonPatch, { Operation as JsonPatchOperation } from 'fast-json-patch'
import { useUserConfigSubscription } from './Hooks/useUserConfigSubscription.js'
import { usePagesInfoSubscription } from './Hooks/usePagesInfoSubscription.js'
import { useActionDefinitionsSubscription } from './Hooks/useActionDefinitionsSubscription.js'
import type { ClientConnectionConfig } from '@companion-app/shared/Model/Common.js'
import type { AllVariableDefinitions, ModuleVariableDefinitions } from '@companion-app/shared/Model/Variables.js'
import type { CustomVariablesModel } from '@companion-app/shared/Model/CustomVariableModel.js'
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

			triggersList: new TriggersListStore(),

			userConfig: new UserConfigStore(),
		} satisfies RootAppStore
	}, [socket])

	const [connections, setConnections] = useState<Record<string, ClientConnectionConfig> | null>(null)

	const [variableDefinitions, setVariableDefinitions] = useState<AllVariableDefinitions | null>(null)
	const [customVariables, setCustomVariables] = useState<CustomVariablesModel | null>(null)

	const completeVariableDefinitions = useMemo<AllVariableDefinitions>(() => {
		if (variableDefinitions) {
			// Generate definitions for all the custom variables
			const customVariableDefinitions: ModuleVariableDefinitions = {}
			for (const [id, info] of Object.entries(customVariables || {})) {
				customVariableDefinitions[`custom_${id}`] = {
					label: info.description,
				}
			}

			return {
				...variableDefinitions,
				internal: {
					...variableDefinitions.internal,
					...customVariableDefinitions,
				},
			}
		} else {
			return {}
		}
	}, [customVariables, variableDefinitions])

	const [loadedEventDefinitions, setLoadedEventDefinitions] = useState(false)

	const actionDefinitionsReady = useActionDefinitionsSubscription(socket, rootStore.actionDefinitions)
	const feedbackDefinitionsReady = useFeedbackDefinitionsSubscription(socket, rootStore.feedbackDefinitions)
	const moduleInfoReady = useModuleInfoSubscription(socket, rootStore.modules)
	const triggersListReady = useTriggersListSubscription(socket, rootStore.triggersList)
	const pagesReady = usePagesInfoSubscription(socket, rootStore.pages)
	const userConfigReady = useUserConfigSubscription(socket, rootStore.userConfig)
	const surfacesReady = useSurfacesSubscription(socket, rootStore.surfaces)

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

			socketEmitPromise(socket, 'variable-definitions:subscribe', [])
				.then((data) => {
					setVariableDefinitions(data || {})
				})
				.catch((e) => {
					console.error('Failed to load variable definitions list', e)
				})
			socketEmitPromise(socket, 'custom-variables:subscribe', [])
				.then((data) => {
					setCustomVariables(data || {})
				})
				.catch((e) => {
					console.error('Failed to load custom values list', e)
				})

			const updateVariableDefinitions = (
				label: string,
				patch: JsonPatchOperation[] | ModuleVariableDefinitions | null
			) => {
				setVariableDefinitions(
					(oldDefinitions) =>
						oldDefinitions &&
						applyPatchOrReplaceSubObject<ModuleVariableDefinitions | undefined>(oldDefinitions, label, patch, {})
				)
			}

			const updateCustomVariables = (patch: JsonPatchOperation[]) => {
				setCustomVariables((oldVariables) => oldVariables && applyPatchOrReplaceObject(oldVariables, patch))
			}

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

			socket.on('variable-definitions:update', updateVariableDefinitions)
			socket.on('custom-variables:update', updateCustomVariables)

			return () => {
				socket.off('variable-definitions:update', updateVariableDefinitions)
				socket.off('custom-variables:update', updateCustomVariables)

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
		variableDefinitions != null,
		completeVariableDefinitions != null,
		actionDefinitionsReady,
		feedbackDefinitionsReady,
		customVariables != null,
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
				<VariableDefinitionsContext.Provider value={completeVariableDefinitions}>
					<CustomVariableDefinitionsContext.Provider value={customVariables!}>
						<NotificationsManager ref={notifierRef} />

						{children(progressPercent, completedSteps.length === steps.length)}
					</CustomVariableDefinitionsContext.Provider>
				</VariableDefinitionsContext.Provider>
			</ConnectionsContext.Provider>
		</RootAppStoreContext.Provider>
	)
}
