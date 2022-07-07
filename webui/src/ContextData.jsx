import { useContext, useEffect, useMemo, useRef, useState } from 'react'
import {
	myApplyPatch,
	ActionsContext,
	FeedbacksContext,
	socketEmit,
	InstancesContext,
	VariableDefinitionsContext,
	CustomVariableDefinitionsContext,
	UserConfigContext,
	SurfacesContext,
	PagesContext,
	TriggersContext,
	socketEmit2,
	myApplyPatch2,
	SocketContext,
	NotifierContext,
	ModulesContext,
} from './util'
import { NotificationsManager } from './Components/Notifications'
import { cloneDeep } from 'lodash-es'
import jsonPatch from 'fast-json-patch'

export function ContextData({ children }) {
	const socket = useContext(SocketContext)

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
			socketEmit2(socket, 'modules:get', [])
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
			socketEmit2(socket, 'action-definitions:subscribe', [])
				.then((data) => {
					setActionDefinitions(data || {})
				})
				.catch((e) => {
					console.error('Failed to load action definitions list', e)
				})
			socketEmit2(socket, 'feedback-definitions:subscribe', [])
				.then((data) => {
					setFeedbackDefinitions(data || {})
				})
				.catch((e) => {
					console.error('Failed to load feedback definitions list', e)
				})
			socketEmit2(socket, 'variable-definitions:subscribe', [])
				.then((data) => {
					setVariableDefinitions(data || {})
				})
				.catch((e) => {
					console.error('Failed to load variable definitions list', e)
				})
			socketEmit2(socket, 'custom-variables:subscribe', [])
				.then((data) => {
					setCustomVariables(data || {})
				})
				.catch((e) => {
					console.error('Failed to load custom values list', e)
				})

			socketEmit(socket, 'get_userconfig_all', [])
				.then(([config]) => {
					setUserConfig(config)
				})
				.catch((e) => {
					console.error('Failed to load user config', e)
				})

			const updateVariableDefinitions = (label, patch) => {
				setVariableDefinitions((oldDefinitions) => myApplyPatch(oldDefinitions, label, patch))
			}
			const updateFeedbackDefinitions = (id, patch) => {
				setFeedbackDefinitions((oldDefinitions) => myApplyPatch(oldDefinitions, id, patch))
			}
			const updateActionDefinitions = (id, patch) => {
				setActionDefinitions((oldDefinitions) => myApplyPatch(oldDefinitions, id, patch))
			}

			const updateUserConfigValue = (key, value) => {
				setUserConfig((oldState) => ({
					...oldState,
					[key]: value,
				}))
			}
			const updateCustomVariables = (patch) => {
				setCustomVariables((oldVariables) => myApplyPatch2(oldVariables, patch))
			}
			const updateTriggers = (patch) => {
				setTriggers((oldVariables) => myApplyPatch2(oldVariables, patch))
			}

			socketEmit2(socket, 'instances:subscribe', [])
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

			socketEmit2(socket, 'surfaces:subscribe', [])
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

			socketEmit2(socket, 'pages:subscribe', [])
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

			const updateTriggerLastRun = (id, time) => {
				setTriggers((list) => {
					if (!list) return list

					const res = { ...list }
					if (res[id]) {
						res[id] = { ...res[id], last_run: time }
					}

					return res
				})
			}

			socket.emit('schedule_get', setTriggers)
			socket.on('schedule:update', updateTriggers)
			socket.on('schedule_last_run', updateTriggerLastRun)

			return () => {
				socket.off('variable-definitions:update', updateVariableDefinitions)
				socket.off('custom-variables:update', updateCustomVariables)
				socket.off('action-definitions:update', updateActionDefinitions)
				socket.off('feedback-definitions:update', updateFeedbackDefinitions)
				socket.off('set_userconfig_key', updateUserConfigValue)
				socket.off('surfaces:patch', patchSurfaces)
				socket.off('pages:update', updatePageInfo)

				socket.off('schedule:update', updateTriggers)
				socket.off('schedule_last_run', updateTriggerLastRun)

				socket.off('instances:patch', patchInstances)

				socketEmit2(socket, 'action-definitions:unsubscribe', []).catch((e) => {
					console.error('Failed to unsubscribe to action definitions list', e)
				})
				socketEmit2(socket, 'feedback-definitions:unsubscribe', []).catch((e) => {
					console.error('Failed to unsubscribe to feedback definitions list', e)
				})
				socketEmit2(socket, 'variable-definitions:unsubscribe', []).catch((e) => {
					console.error('Failed to unsubscribe to variable definitions list', e)
				})
				socketEmit2(socket, 'instances:unsubscribe', []).catch((e) => {
					console.error('Failed to unsubscribe from instances list:', e)
				})
				socketEmit2(socket, 'surfaces:unsubscribe', []).catch((e) => {
					console.error('Failed to unsubscribe from surfaces', e)
				})
				socketEmit2(socket, 'custom-variables:unsubscribe', []).catch((e) => {
					console.error('Failed to unsubscribe from custom variables', e)
				})
				socketEmit2(socket, 'pages:unsubscribe', []).catch((e) => {
					console.error('Failed to unsubscribe pages list:', e)
				})
			}
		}
	}, [socket])

	const notifierRef = useRef()

	const contextValue = useMemo(
		() => ({
			socket: socket,
			notifier: notifierRef,
			modules: modules,
		}),
		[socket, notifierRef, modules]
	)

	const steps = [
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
		</NotifierContext.Provider>
	)
}
