import { useEffect, useRef, useState } from 'react'
import {
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
	socketEmit2,
} from './util'
import { NotificationsManager } from './Components/Notifications'
import { cloneDeep } from 'lodash-es'
import jsonPatch from 'fast-json-patch'

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
		const setCustomVariablesAndUpdateVariables = (data) => {
			setCustomVariables(data || {})
			setVariableDefinitions((oldVars) => {
				const newVars = { ...oldVars }
				newVars.internal = compileCustomVariableVariables(newVars.internal || [], data || {})
				return newVars
			})
		}
		const compileCustomVariableVariables = (oldInternalVars, customVariables) => {
			const newVars = [...oldInternalVars.filter((v) => !v.name.startsWith('custom_'))]

			for (const [id, info] of Object.entries(customVariables)) {
				newVars.push({
					name: `custom_${id}`,
					label: info.description,
				})
			}

			return newVars
		}
		if (socket) {
			socketEmit2(socket, 'modules:get', [])
				.then((modules) => {
					const modulesObj = {}
					const redirectsObj = {}
					for (const mod of modules) {
						modulesObj[mod.id] = mod

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
					setCustomVariables((oldCustomVars) => {
						const fullData = data || {}
						fullData.internal = compileCustomVariableVariables(fullData.internal || [], oldCustomVars || {})
						setVariableDefinitions(fullData)

						return oldCustomVars
					})
				})
				.catch((e) => {
					console.error('Failed to load variable definitions list', e)
				})
			socketEmit(socket, 'custom_variables_get', [])
				.then(([data]) => {
					setCustomVariablesAndUpdateVariables(data || {})
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

			const updateVariableDefinitions = (label, variables) => {
				if (label === 'internal') {
					setCustomVariables((oldCustomVars) => {
						const internalVariables = compileCustomVariableVariables(variables, oldCustomVars || {})

						setVariableDefinitions((oldDefinitions) => ({
							...oldDefinitions,
							[label]: internalVariables,
						}))

						return oldCustomVars
					})
				} else {
					setVariableDefinitions((oldDefinitions) => ({
						...oldDefinitions,
						[label]: variables,
					}))
				}
			}
			const updateFeedbackDefinitions = (id, feedbacks) => {
				setFeedbackDefinitions((oldDefinitions) => ({
					...oldDefinitions,
					[id]: feedbacks,
				}))
			}
			const updateActionDefinitions = (id, actions) => {
				setActionDefinitions((oldDefinitions) => ({
					...oldDefinitions,
					[id]: actions,
				}))
			}

			const updateUserConfigValue = (key, value) => {
				setUserConfig((oldState) => ({
					...oldState,
					[key]: value,
				}))
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
			socket.on('custom_variables_get', setCustomVariablesAndUpdateVariables)

			socket.on('action-definitions:update', updateActionDefinitions)
			socket.on('feedback-definitions:update', updateFeedbackDefinitions)

			socket.on('set_userconfig_key', updateUserConfigValue)

			socket.on('devices_list', setSurfaces)
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

					return list.map((l) => {
						if (l.id === id) {
							return {
								...l,
								last_run: time,
							}
						} else {
							return l
						}
					})
				})
			}

			socket.emit('schedule_get', setTriggers)
			socket.on('schedule_refresh', setTriggers)
			socket.on('schedule_last_run', updateTriggerLastRun)

			return () => {
				socket.off('variable-definitions:update', updateVariableDefinitions)
				socket.off('custom_variables_get', setCustomVariablesAndUpdateVariables)
				socket.off('action-definitions:update', updateActionDefinitions)
				socket.off('feedback-definitions:update', updateFeedbackDefinitions)
				socket.off('set_userconfig_key', updateUserConfigValue)
				socket.off('devices_list', setSurfaces)
				socket.off('set_page', updatePageInfo)

				socket.off('schedule_refresh', setTriggers)
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
