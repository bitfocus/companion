import { useEffect, useRef, useState } from 'react'
import debounce from 'debounce-fn'
import {
	StaticContext,
	ActionsContext,
	FeedbacksContext,
	socketEmit,
	InstancesContext,
	VariableValuesContext,
	VariableDefinitionsContext,
	CustomVariableDefinitionsContext,
} from './util'
import { NotificationsManager } from './Components/Notifications'

export function ContextData({ socket, children }) {
	const [instances, setInstances] = useState(null)
	const [modules, setModules] = useState(null)
	const [actions, setActions] = useState(null)
	const [feedbacks, setFeedbacks] = useState(null)
	const [variableDefinitions, setVariableDefinitions] = useState(null)
	const [variableValues, setVariableValues] = useState(null)
	const [customVariables, setCustomVariables] = useState(null)

	useEffect(() => {
		if (socket) {
			socketEmit(socket, 'modules_get', [])
				.then(([res]) => {
					const modulesObj = {}
					for (const mod of res.modules) {
						modulesObj[mod.name] = mod
					}
					setModules(modulesObj)
				})
				.catch((e) => {
					console.error('Failed to load modules list', e)
				})
			socketEmit(socket, 'variable_instance_definitions_get', [])
				.then(([data]) => {
					setVariableDefinitions(data || {})
				})
				.catch((e) => {
					console.error('Failed to load variable definitions list', e)
				})
			socketEmit(socket, 'variables_get', [])
				.then(([data]) => {
					setVariableValues(data || {})
				})
				.catch((e) => {
					console.error('Failed to load variable values list', e)
				})
			socketEmit(socket, 'custom_variables_get', [])
				.then(([data]) => {
					setCustomVariables(data || {})
				})
				.catch((e) => {
					console.error('Failed to load custom values list', e)
				})

			const updateVariableDefinitions = (label, variables) => {
				setVariableDefinitions((oldDefinitions) => ({
					...oldDefinitions,
					[label]: variables,
				}))
			}

			let variablesQueue = {}
			const persistVariableValues = debounce(
				() => {
					setVariableValues((oldValues) => {
						const newValues = { ...oldValues }
						for (const [key, value] of Object.entries(variablesQueue)) {
							if (value === null) {
								delete newValues[key]
							} else {
								newValues[key] = value
							}
						}
						variablesQueue = {}
						return newValues
					})
				},
				{
					after: true,
					maxWait: 2000,
					wait: 500,
				}
			)
			const updateVariableValue = (changed_variables, removed_variables) => {
				// Don't commit to state immediately, run through a debounce to rate limit the renders
				for (const [key, value] of Object.entries(changed_variables)) {
					variablesQueue[key] = value
				}
				for (const variable of removed_variables) {
					variablesQueue[variable] = undefined
				}
				persistVariableValues()
			}

			socket.on('instances_get:result', setInstances)
			socket.emit('instances_get')

			socket.on('variable_instance_definitions_set', updateVariableDefinitions)
			socket.on('variables_set', updateVariableValue)
			socket.on('custom_variables_get', setCustomVariables)

			socket.on('actions', setActions)
			socket.emit('get_actions')

			socket.on('feedback_get_definitions:result', setFeedbacks)
			socket.emit('feedback_get_definitions')

			return () => {
				socket.off('instances_get:result', setInstances)
				socket.off('variable_instance_definitions_set', updateVariableDefinitions)
				socket.off('variables_set', updateVariableValue)
				socket.off('custom_variables_get', setCustomVariables)
				socket.off('actions', setActions)
				socket.off('feedback_get_definitions:result', setFeedbacks)
			}
		}
	}, [socket])

	const notifierRef = useRef()

	const contextValue = {
		socket: socket,
		notifier: notifierRef,
		modules: modules,
	}

	const steps = [instances, modules, variableDefinitions, variableValues, actions, feedbacks, customVariables]
	const completedSteps = steps.filter((s) => s !== null && s !== undefined)

	const progressPercent = (completedSteps.length / steps.length) * 100

	return (
		<StaticContext.Provider value={contextValue}>
			<ActionsContext.Provider value={actions}>
				<FeedbacksContext.Provider value={feedbacks}>
					<InstancesContext.Provider value={instances}>
						<VariableValuesContext.Provider value={variableValues}>
							<VariableDefinitionsContext.Provider value={variableDefinitions}>
								<CustomVariableDefinitionsContext.Provider value={customVariables}>
									<NotificationsManager ref={notifierRef} />

									{children(progressPercent, completedSteps.length === steps.length)}
								</CustomVariableDefinitionsContext.Provider>
							</VariableDefinitionsContext.Provider>
						</VariableValuesContext.Provider>
					</InstancesContext.Provider>
				</FeedbacksContext.Provider>
			</ActionsContext.Provider>
		</StaticContext.Provider>
	)
}
