import { useEffect, useRef, useState } from 'react'
import debounce from 'debounce-fn'
import { CompanionContext, socketEmit } from './util'
import { NotificationsManager } from './Components/Notifications'

export function ContextData({ socket, children }) {
	const [instances, setInstances] = useState(null)
	const [modules, setModules] = useState(null)
	const [actions, setActions] = useState(null)
	const [feedbacks, setFeedbacks] = useState(null)
	const [variableDefinitions, setVariableDefinitions] = useState(null)
	const [variableValues, setVariableValues] = useState(null)

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
			const updateVariableValue = (key, value) => {
				// Don't commit to state immediately, run through a debounce to rate limit the renders
				variablesQueue[key] = value
				persistVariableValues()
			}

			socket.on('instances_get:result', setInstances)
			socket.emit('instances_get')

			socket.on('variable_instance_definitions_set', updateVariableDefinitions)
			socket.on('variable_set', updateVariableValue)

			socket.on('actions', setActions)
			socket.emit('get_actions')

			socket.on('feedback_get_definitions:result', setFeedbacks)
			socket.emit('feedback_get_definitions')

			return () => {
				socket.off('instances_get:result', setInstances)
				socket.off('variable_instance_definitions_set', updateVariableDefinitions)
				socket.off('variable_set', updateVariableValue)
				socket.off('actions', setActions)
				socket.off('feedback_get_definitions:result', setFeedbacks)
			}
		}
	}, [socket])

	const notifierRef = useRef()

	const contextValue = {
		socket: socket,
		notifier: notifierRef,

		instances: instances,
		modules: modules,
		variableDefinitions: variableDefinitions,
		variableValues: variableValues,
		actions: actions,
		feedbacks: feedbacks,
	}

	const steps = [instances, modules, variableDefinitions, variableValues, actions, feedbacks]
	const completedSteps = steps.filter((s) => s !== null && s !== undefined)

	const progressPercent = (completedSteps.length / steps.length) * 100

	return (
		<CompanionContext.Provider value={contextValue}>
			<NotificationsManager ref={notifierRef} />

			{children(progressPercent, completedSteps.length === steps.length)}
		</CompanionContext.Provider>
	)
}
