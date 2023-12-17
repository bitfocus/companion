import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import {
	applyPatchOrReplaceSubObject,
	ActionsContext,
	FeedbacksContext,
	ConnectionsContext,
	VariableDefinitionsContext,
	CustomVariableDefinitionsContext,
	UserConfigContext,
	SurfacesContext,
	PagesContext,
	TriggersContext,
	socketEmitPromise,
	applyPatchOrReplaceObject,
	SocketContext,
	NotifierContext,
	EventDefinitionsContext,
	ModulesContext,
	RecentActionsContext,
	RecentFeedbacksContext,
	ActiveLearnContext,
} from './util'
import { NotificationsManager, NotificationsManagerRef } from './Components/Notifications'
import { cloneDeep } from 'lodash-es'
import jsonPatch, { Operation as JsonPatchOperation } from 'fast-json-patch'
import { useUserConfigSubscription } from './Hooks/useUserConfigSubscription'
import { usePagesInfoSubscription } from './Hooks/usePagesInfoSubscription'
import type { ClientConnectionConfig, ClientEventDefinition, ModuleDisplayInfo } from '@companion/shared/Model/Common'
import type { ClientActionDefinition, InternalFeedbackDefinition } from '@companion/shared/Model/Options'
import type { AllVariableDefinitions, ModuleVariableDefinitions } from '@companion/shared/Model/Variables'
import type { CustomVariablesModel } from '@companion/shared/Model/CustomVariableModel'
import type { ClientDevicesListItem } from '@companion/shared/Model/Surfaces'
import type { ClientTriggerData } from '@companion/shared/Model/TriggerModel'
import { useActiveLearnRequests } from './_Model/ActiveLearn'

interface ContextDataProps {
	children: (progressPercent: number, loadingComplete: boolean) => React.JSX.Element | React.JSX.Element[]
}

export function ContextData({ children }: ContextDataProps) {
	const socket = useContext(SocketContext)

	const [eventDefinitions, setEventDefinitions] = useState<Record<string, ClientEventDefinition | undefined> | null>(
		null
	)
	const [connections, setConnections] = useState<Record<string, ClientConnectionConfig> | null>(null)
	const [modules, setModules] = useState<Record<string, ModuleDisplayInfo> | null>(null)
	const [actionDefinitions, setActionDefinitions] = useState<Record<
		string,
		Record<string, ClientActionDefinition | undefined> | undefined
	> | null>(null)
	const [feedbackDefinitions, setFeedbackDefinitions] = useState<Record<
		string,
		Record<string, InternalFeedbackDefinition | undefined> | undefined
	> | null>(null)
	const [variableDefinitions, setVariableDefinitions] = useState<AllVariableDefinitions | null>(null)
	const [customVariables, setCustomVariables] = useState<CustomVariablesModel | null>(null)
	const [surfaces, setSurfaces] = useState<Record<string, ClientDevicesListItem | undefined> | null>(null)
	const [triggers, setTriggers] = useState<Record<string, ClientTriggerData | undefined> | null>(null)

	const [recentActions, setRecentActions] = useState<string[]>(() => {
		const recent = JSON.parse(window.localStorage.getItem('recent_actions') || '[]')
		return Array.isArray(recent) ? recent : []
	})

	const trackRecentAction = useCallback((actionType: string) => {
		setRecentActions((existing) => {
			const newActions = [actionType, ...existing.filter((v) => v !== actionType)].slice(0, 20)

			window.localStorage.setItem('recent_actions', JSON.stringify(newActions))

			return newActions
		})
	}, [])
	const recentActionsContext = useMemo(
		() => ({
			recentActions,
			trackRecentAction,
		}),
		[recentActions, trackRecentAction]
	)

	const [recentFeedbacks, setRecentFeedbacks] = useState<string[]>(() => {
		const recent = JSON.parse(window.localStorage.getItem('recent_feedbacks') || '[]')
		return Array.isArray(recent) ? recent : []
	})

	const trackRecentFeedback = useCallback((feedbackType: string) => {
		setRecentFeedbacks((existing) => {
			const newFeedbacks = [feedbackType, ...existing.filter((v) => v !== feedbackType)].slice(0, 20)

			window.localStorage.setItem('recent_feedbacks', JSON.stringify(newFeedbacks))

			return newFeedbacks
		})
	}, [])
	const recentFeedbacksContext = useMemo(
		() => ({
			recentFeedbacks,
			trackRecentFeedback,
		}),
		[recentFeedbacks, trackRecentFeedback]
	)

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

	const pages = usePagesInfoSubscription(socket)
	const userConfig = useUserConfigSubscription(socket)

	useEffect(() => {
		if (socket) {
			socketEmitPromise(socket, 'event-definitions:get', [])
				.then((definitions) => {
					setEventDefinitions(definitions)
				})
				.catch((e) => {
					console.error('Failed to load event definitions', e)
				})

			socketEmitPromise(socket, 'modules:subscribe', [])
				.then((modules) => {
					setModules(modules)
				})
				.catch((e) => {
					console.error('Failed to load modules list', e)
				})
			socketEmitPromise(socket, 'action-definitions:subscribe', [])
				.then((data) => {
					setActionDefinitions(data || {})
				})
				.catch((e) => {
					console.error('Failed to load action definitions list', e)
				})
			socketEmitPromise(socket, 'feedback-definitions:subscribe', [])
				.then((data) => {
					setFeedbackDefinitions(data || {})
				})
				.catch((e) => {
					console.error('Failed to load feedback definitions list', e)
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

			const updateVariableDefinitions = (label: string, patch: JsonPatchOperation[]) => {
				setVariableDefinitions(
					(oldDefinitions) =>
						oldDefinitions &&
						applyPatchOrReplaceSubObject<ModuleVariableDefinitions | undefined>(oldDefinitions, label, patch, {})
				)
			}
			const updateFeedbackDefinitions = (id: string, patch: JsonPatchOperation[]) => {
				setFeedbackDefinitions(
					(oldDefinitions) => oldDefinitions && applyPatchOrReplaceSubObject(oldDefinitions, id, patch, {})
				)
			}
			const updateActionDefinitions = (id: string, patch: JsonPatchOperation[]) => {
				setActionDefinitions(
					(oldDefinitions) => oldDefinitions && applyPatchOrReplaceSubObject(oldDefinitions, id, patch, {})
				)
			}

			const updateCustomVariables = (patch: JsonPatchOperation[]) => {
				setCustomVariables((oldVariables) => oldVariables && applyPatchOrReplaceObject(oldVariables, patch))
			}
			const updateTriggers = (controlId: string, patch: JsonPatchOperation[]) => {
				setTriggers(
					(oldTriggers) =>
						oldTriggers &&
						applyPatchOrReplaceSubObject(oldTriggers, controlId, patch, {
							// Placeholder data
							type: 'trigger',
							name: '',
							lastExecuted: undefined,
							enabled: false,
							description: '',
							sortOrder: 0,
							relativeDelay: false,
						})
				)
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

			const patchModules = (patch: JsonPatchOperation[] | false) => {
				setModules((oldModules) => {
					if (patch === false) {
						return {}
					} else {
						return jsonPatch.applyPatch(cloneDeep(oldModules) || {}, patch).newDocument
					}
				})
			}
			socket.on('modules:patch', patchModules)

			socket.on('variable-definitions:update', updateVariableDefinitions)
			socket.on('custom-variables:update', updateCustomVariables)

			socket.on('action-definitions:update', updateActionDefinitions)
			socket.on('feedback-definitions:update', updateFeedbackDefinitions)

			socketEmitPromise(socket, 'surfaces:subscribe', [])
				.then((surfaces) => {
					setSurfaces(surfaces)
				})
				.catch((e) => {
					console.error('Failed to load surfaces', e)
				})

			const patchSurfaces = (patch: JsonPatchOperation[]) => {
				setSurfaces((oldSurfaces) => {
					return oldSurfaces && jsonPatch.applyPatch(cloneDeep(oldSurfaces) || {}, patch).newDocument
				})
			}
			socket.on('surfaces:patch', patchSurfaces)

			socketEmitPromise(socket, 'triggers:subscribe', [])
				.then((triggers) => {
					// setLoadError(null)
					setTriggers(triggers)
				})
				.catch((e) => {
					console.error('Failed to load triggers list:', e)
					// setLoadError(`Failed to load pages list`)
					setTriggers(null)
				})

			socket.on('triggers:update', updateTriggers)

			return () => {
				socket.off('variable-definitions:update', updateVariableDefinitions)
				socket.off('custom-variables:update', updateCustomVariables)
				socket.off('action-definitions:update', updateActionDefinitions)
				socket.off('feedback-definitions:update', updateFeedbackDefinitions)
				socket.off('surfaces:patch', patchSurfaces)

				socket.off('triggers:update', updateTriggers)

				socket.off('connections:patch', patchInstances)
				socket.off('modules:patch', patchModules)

				socketEmitPromise(socket, 'action-definitions:unsubscribe', []).catch((e) => {
					console.error('Failed to unsubscribe to action definitions list', e)
				})
				socketEmitPromise(socket, 'feedback-definitions:unsubscribe', []).catch((e) => {
					console.error('Failed to unsubscribe to feedback definitions list', e)
				})
				socketEmitPromise(socket, 'variable-definitions:unsubscribe', []).catch((e) => {
					console.error('Failed to unsubscribe to variable definitions list', e)
				})
				socketEmitPromise(socket, 'connections:unsubscribe', []).catch((e) => {
					console.error('Failed to unsubscribe from instances list:', e)
				})
				socketEmitPromise(socket, 'modules:unsubscribe', []).catch((e) => {
					console.error('Failed to unsubscribe from modules list:', e)
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

	const [activeLearnRequests, activeLearnRequestsReady] = useActiveLearnRequests(socket)

	const notifierRef = useRef<NotificationsManagerRef>(null)

	const steps = [
		eventDefinitions,
		connections,
		modules,
		variableDefinitions,
		completeVariableDefinitions,
		actionDefinitions,
		feedbackDefinitions,
		customVariables,
		userConfig,
		surfaces,
		pages,
		triggers,
		activeLearnRequestsReady,
	]
	const completedSteps = steps.filter((s) => s !== null && s !== undefined)

	const progressPercent = (completedSteps.length / steps.length) * 100

	return (
		<NotifierContext.Provider value={notifierRef}>
			<EventDefinitionsContext.Provider value={eventDefinitions!}>
				<ModulesContext.Provider value={modules!}>
					<ActionsContext.Provider value={actionDefinitions!}>
						<FeedbacksContext.Provider value={feedbackDefinitions!}>
							<ConnectionsContext.Provider value={connections!}>
								<VariableDefinitionsContext.Provider value={completeVariableDefinitions}>
									<CustomVariableDefinitionsContext.Provider value={customVariables!}>
										<UserConfigContext.Provider value={userConfig}>
											<SurfacesContext.Provider value={surfaces!}>
												<PagesContext.Provider value={pages!}>
													<TriggersContext.Provider value={triggers!}>
														<RecentActionsContext.Provider value={recentActionsContext}>
															<RecentFeedbacksContext.Provider value={recentFeedbacksContext}>
																<ActiveLearnContext.Provider value={activeLearnRequests}>
																	<NotificationsManager ref={notifierRef} />

																	{children(progressPercent, completedSteps.length === steps.length)}
																</ActiveLearnContext.Provider>
															</RecentFeedbacksContext.Provider>
														</RecentActionsContext.Provider>
													</TriggersContext.Provider>
												</PagesContext.Provider>
											</SurfacesContext.Provider>
										</UserConfigContext.Provider>
									</CustomVariableDefinitionsContext.Provider>
								</VariableDefinitionsContext.Provider>
							</ConnectionsContext.Provider>
						</FeedbacksContext.Provider>
					</ActionsContext.Provider>
				</ModulesContext.Provider>
			</EventDefinitionsContext.Provider>
		</NotifierContext.Provider>
	)
}
