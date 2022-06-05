import { useEffect, useRef, useState } from 'react'
import {
	myApplyPatch,
	StaticContext,
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
	myApplyPatch2,
} from './util'
import { NotificationsManager } from './Components/Notifications'

export function ContextData({ socket, children }) {
	const [instances, setInstances] = useState(null)
	const [modules, setModules] = useState(null)
	const [moduleRedirects, setModuleRedirects] = useState(null)
	const [actionDefinitions, setActionDefinitions] = useState(null)
	const [feedbackDefinitions, setFeedbackDefinitions] = useState(null)
	const [variableDefinitions, setVariableDefinitions] = useState(null)
	const [customVariables, setCustomVariables] = useState(null)
	const [userConfig, setUserConfig] = useState(null)
	const [surfaces, setSurfaces] = useState(null)
	const [pages, setPages] = useState(null)
	const [triggers, setTriggers] = useState(null)

	useEffect(() => {
		if (socket) {
			socketEmit(socket, 'modules_get', [])
				.then(([res]) => {
					const modulesObj = {}
					const redirectsObj = {}
					for (const mod of res.modules) {
						modulesObj[mod.name] = mod

						// Add legacy names to the redirect list
						if (mod.legacy && Array.isArray(mod.legacy)) {
							for (const from of mod.legacy) {
								redirectsObj[from] = mod.name
							}
						}
					}
					setModules(modulesObj)
					setModuleRedirects(redirectsObj)
				})
				.catch((e) => {
					console.error('Failed to load modules list', e)
				})
			socketEmit(socket, 'action_instance_definitions_get', [])
				.then(([data]) => {
					setActionDefinitions(data || {})
				})
				.catch((e) => {
					console.error('Failed to load variable definitions list', e)
				})
			socketEmit(socket, 'feedback_instance_definitions_get', [])
				.then(([data]) => {
					setFeedbackDefinitions(data || {})
				})
				.catch((e) => {
					console.error('Failed to load variable definitions list', e)
				})
			socketEmit(socket, 'variable_instance_definitions_get', [])
				.then(([data]) => {
					setVariableDefinitions(data || {})
				})
				.catch((e) => {
					console.error('Failed to load variable definitions list', e)
				})
			socketEmit(socket, 'custom_variables_get', [])
				.then(([data]) => {
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
			const updateSurfaces = (patch) => {
				console.log('surfaces', patch)
				setSurfaces((oldSurfaces) => myApplyPatch2(oldSurfaces, patch))
			}
			const updateCustomVariables = (patch) => {
				setCustomVariables((oldVariables) => myApplyPatch2(oldVariables, patch))
			}
			const updateTriggers = (patch) => {
				setTriggers((oldVariables) => myApplyPatch2(oldVariables, patch))
			}

			socket.on('instances_get:result', setInstances)
			socket.emit('instances_get')

			socket.on('variable_instance_definitions_patch', updateVariableDefinitions)
			socket.on('custom_variables_get', updateCustomVariables)

			socket.on('action_instance_definitions_patch', updateActionDefinitions)

			socket.on('feedback_instance_definitions_patch', updateFeedbackDefinitions)

			socket.on('set_userconfig_key', updateUserConfigValue)

			socket.on('devices_list', updateSurfaces)
			socket.emit('devices_list_get')

			socketEmit(socket, 'get_page_all', [])
				.then(([pages]) => {
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

			socket.on('set_page', updatePageInfo)

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
			socket.on('schedule_refresh', updateTriggers)
			socket.on('schedule_last_run', updateTriggerLastRun)

			return () => {
				socket.off('instances_get:result', setInstances)
				socket.off('variable_instance_definitions_patch', updateVariableDefinitions)
				socket.off('custom_variables_get', updateCustomVariables)
				socket.off('action_instance_definitions_patch', updateActionDefinitions)
				socket.off('feedback_instance_definitions_patch', updateFeedbackDefinitions)
				socket.off('set_userconfig_key', updateUserConfigValue)
				socket.off('devices_list', updateSurfaces)
				socket.off('set_page', updatePageInfo)

				socket.off('schedule_refresh', updateTriggers)
				socket.off('schedule_last_run', updateTriggerLastRun)
			}
		}
	}, [socket])

	const notifierRef = useRef()

	const contextValue = {
		socket: socket,
		notifier: notifierRef,
		modules: modules,
		moduleRedirects: moduleRedirects,
		currentVersion: 22,
	}

	const steps = [
		instances,
		modules,
		variableDefinitions,
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
		<StaticContext.Provider value={contextValue}>
			<ActionsContext.Provider value={actionDefinitions}>
				<FeedbacksContext.Provider value={feedbackDefinitions}>
					<InstancesContext.Provider value={instances}>
						<VariableDefinitionsContext.Provider value={variableDefinitions}>
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
		</StaticContext.Provider>
	)
}
