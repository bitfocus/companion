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

			const updateVariableDefinitions = (label, variables) => {
				setVariableDefinitions((oldDefinitions) => ({
					...oldDefinitions,
					[label]: variables,
				}))
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

			socket.on('instances_get:result', setInstances)
			socket.emit('instances_get')

			socket.on('variable_instance_definitions_set', updateVariableDefinitions)
			socket.on('custom_variables_get', setCustomVariables)

			socket.on('action_instance_definitions_set', updateActionDefinitions)

			socket.on('feedback_instance_definitions_set', updateFeedbackDefinitions)

			socket.on('set_userconfig_key', updateUserConfigValue)

			return () => {
				socket.off('instances_get:result', setInstances)
				socket.off('variable_instance_definitions_set', updateVariableDefinitions)
				socket.off('custom_variables_get', setCustomVariables)
				socket.off('action_instance_definitions_set', updateActionDefinitions)
				socket.off('feedback_instance_definitions_set', updateFeedbackDefinitions)
				socket.off('set_userconfig_key', updateUserConfigValue)
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
									<NotificationsManager ref={notifierRef} />

									{children(progressPercent, completedSteps.length === steps.length)}
								</UserConfigContext.Provider>
							</CustomVariableDefinitionsContext.Provider>
						</VariableDefinitionsContext.Provider>
					</InstancesContext.Provider>
				</FeedbacksContext.Provider>
			</ActionsContext.Provider>
		</StaticContext.Provider>
	)
}
