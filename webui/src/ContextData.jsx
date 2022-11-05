import { useContext, useEffect, useMemo, useRef, useState } from 'react'
import {
	applyPatchOrReplaceSubObject,
	ActionsContext,
	FeedbacksContext,
	InstancesContext,
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
	ButtonRenderCacheContext,
} from './util'
import { NotificationsManager } from './Components/Notifications'
import { cloneDeep } from 'lodash-es'
import jsonPatch from 'fast-json-patch'
import { ButtonRenderCache } from './ButtonRenderCache'

export function ContextData({ children }) {
	const socket = useContext(SocketContext)

	const [eventDefinitions, setEventDefinitions] = useState(null)
	const [instances, setInstances] = useState(null)
	const [modules, setModules] = useState(null)
	const [actionDefinitions, setActionDefinitions] = useState(null)
	const [feedbackDefinitions, setFeedbackDefinitions] = useState(null)
	const [variableDefinitions, setVariableDefinitions] = useState(null)
	const [customVariables, setCustomVariables] = useState(null)
	const [userConfig, setUserConfig] = useState(null)
	const [surfaces, setSurfaces] = useState(null)
	const [pages, setPages] = useState(null)
	const [triggers, setTriggers] = useState(null)

	const buttonCache = useMemo(() => {
		return new ButtonRenderCache(socket)
	}, [socket])

	const completeVariableDefinitions = useMemo(() => {
		if (variableDefinitions) {
			// Generate definitions for all the custom variables
			const customVariableDefinitions = {}
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
			return null
		}
	}, [customVariables, variableDefinitions])

	useEffect(() => {
		if (socket) {
			socketEmitPromise(socket, 'event-definitions:get', [])
				.then((definitions) => {
					setEventDefinitions(definitions)
				})
				.catch((e) => {
					console.error('Failed to load event definitions')
				})

			socketEmitPromise(socket, 'modules:get', [])
				.then((modules) => {
					const modulesObj = {}
					for (const mod of modules) {
						modulesObj[mod.id] = mod
					}
					setModules(modulesObj)
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

			socketEmitPromise(socket, 'userconfig:get-all', [])
				.then((config) => {
					setUserConfig(config)
				})
				.catch((e) => {
					console.error('Failed to load user config', e)
				})

			const updateVariableDefinitions = (label, patch) => {
				setVariableDefinitions((oldDefinitions) => applyPatchOrReplaceSubObject(oldDefinitions, label, patch))
			}
			const updateFeedbackDefinitions = (id, patch) => {
				setFeedbackDefinitions((oldDefinitions) => applyPatchOrReplaceSubObject(oldDefinitions, id, patch))
			}
			const updateActionDefinitions = (id, patch) => {
				setActionDefinitions((oldDefinitions) => applyPatchOrReplaceSubObject(oldDefinitions, id, patch))
			}

			const updateUserConfigValue = (key, value) => {
				setUserConfig((oldState) => ({
					...oldState,
					[key]: value,
				}))
			}
			const updateCustomVariables = (patch) => {
				setCustomVariables((oldVariables) => applyPatchOrReplaceObject(oldVariables, patch))
			}
			const updateTriggers = (controlId, patch) => {
				console.log('trigger', controlId, patch)
				setTriggers((oldTriggers) => applyPatchOrReplaceSubObject(oldTriggers, controlId, patch))
			}

			socketEmitPromise(socket, 'instances:subscribe', [])
				.then((instances) => {
					setInstances(instances)
				})
				.catch((e) => {
					console.error('Failed to load instances list:', e)
					setInstances(null)
				})

			const patchInstances = (patch) => {
				setInstances((oldInstances) => {
					if (patch === false) {
						return false
					} else {
						return jsonPatch.applyPatch(cloneDeep(oldInstances) || {}, patch).newDocument
					}
				})
			}
			socket.on('instances:patch', patchInstances)

			socket.on('variable-definitions:update', updateVariableDefinitions)
			socket.on('custom-variables:update', updateCustomVariables)

			socket.on('action-definitions:update', updateActionDefinitions)
			socket.on('feedback-definitions:update', updateFeedbackDefinitions)

			socket.on('set_userconfig_key', updateUserConfigValue)

			socketEmitPromise(socket, 'surfaces:subscribe', [])
				.then((surfaces) => {
					setSurfaces(surfaces)
				})
				.catch((e) => {
					console.error('Failed to load surfaces', e)
				})

			const patchSurfaces = (patch) => {
				setSurfaces((oldSurfaces) => {
					return jsonPatch.applyPatch(cloneDeep(oldSurfaces) || {}, patch).newDocument
				})
			}
			socket.on('surfaces:patch', patchSurfaces)

			socketEmitPromise(socket, 'pages:subscribe', [])
				.then((pages) => {
					// setLoadError(null)
					setPages(pages)
				})
				.catch((e) => {
					console.error('Failed to load pages list:', e)
					// setLoadError(`Failed to load pages list`)
					setPages(null)
				})

			const updatePageInfo = (page, info) => {
				setPages((oldPages) => {
					if (oldPages) {
						return {
							...oldPages,
							[page]: info,
						}
					} else {
						return null
					}
				})
			}

			socket.on('pages:update', updatePageInfo)

			socketEmitPromise(socket, 'triggers:subscribe', [])
				.then((pages) => {
					// setLoadError(null)
					setTriggers(pages)
				})
				.catch((e) => {
					console.error('Failed to load triggers list:', e)
					// setLoadError(`Failed to load pages list`)
					setPages(null)
				})

			socket.on('triggers:update', updateTriggers)

			return () => {
				socket.off('variable-definitions:update', updateVariableDefinitions)
				socket.off('custom-variables:update', updateCustomVariables)
				socket.off('action-definitions:update', updateActionDefinitions)
				socket.off('feedback-definitions:update', updateFeedbackDefinitions)
				socket.off('set_userconfig_key', updateUserConfigValue)
				socket.off('surfaces:patch', patchSurfaces)
				socket.off('pages:update', updatePageInfo)

				socket.off('triggers:update', updateTriggers)

				socket.off('instances:patch', patchInstances)

				socketEmitPromise(socket, 'action-definitions:unsubscribe', []).catch((e) => {
					console.error('Failed to unsubscribe to action definitions list', e)
				})
				socketEmitPromise(socket, 'feedback-definitions:unsubscribe', []).catch((e) => {
					console.error('Failed to unsubscribe to feedback definitions list', e)
				})
				socketEmitPromise(socket, 'variable-definitions:unsubscribe', []).catch((e) => {
					console.error('Failed to unsubscribe to variable definitions list', e)
				})
				socketEmitPromise(socket, 'instances:unsubscribe', []).catch((e) => {
					console.error('Failed to unsubscribe from instances list:', e)
				})
				socketEmitPromise(socket, 'surfaces:unsubscribe', []).catch((e) => {
					console.error('Failed to unsubscribe from surfaces', e)
				})
				socketEmitPromise(socket, 'custom-variables:unsubscribe', []).catch((e) => {
					console.error('Failed to unsubscribe from custom variables', e)
				})
				socketEmitPromise(socket, 'pages:unsubscribe', []).catch((e) => {
					console.error('Failed to unsubscribe pages list:', e)
				})
			}
		}
	}, [socket])

	const notifierRef = useRef()

	const steps = [
		eventDefinitions,
		instances,
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
	]
	const completedSteps = steps.filter((s) => s !== null && s !== undefined)

	const progressPercent = (completedSteps.length / steps.length) * 100

	return (
		<NotifierContext.Provider value={notifierRef}>
			<ButtonRenderCacheContext.Provider value={buttonCache}>
				<EventDefinitionsContext.Provider value={eventDefinitions}>
					<ModulesContext.Provider value={modules}>
						<ActionsContext.Provider value={actionDefinitions}>
							<FeedbacksContext.Provider value={feedbackDefinitions}>
								<InstancesContext.Provider value={instances}>
									<VariableDefinitionsContext.Provider value={completeVariableDefinitions}>
										<CustomVariableDefinitionsContext.Provider value={customVariables}>
											<UserConfigContext.Provider value={userConfig}>
												<SurfacesContext.Provider value={surfaces}>
													<PagesContext.Provider value={pages}>
														<TriggersContext.Provider value={triggers}>
															<NotificationsManager ref={notifierRef} />

															{children(progressPercent, completedSteps.length === steps.length)}
														</TriggersContext.Provider>
													</PagesContext.Provider>
												</SurfacesContext.Provider>
											</UserConfigContext.Provider>
										</CustomVariableDefinitionsContext.Provider>
									</VariableDefinitionsContext.Provider>
								</InstancesContext.Provider>
							</FeedbacksContext.Provider>
						</ActionsContext.Provider>
					</ModulesContext.Provider>
				</EventDefinitionsContext.Provider>
			</ButtonRenderCacheContext.Provider>
		</NotifierContext.Provider>
	)
}
