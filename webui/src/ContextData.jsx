import { useEffect, useState } from "react"
import { CompanionContext, socketEmit } from "./util"

export function ContextData({ socket, children }) {

	const [instances, setInstances] = useState({})
	const [modules, setModules] = useState({})
	const [actions, setActions] = useState({})
	const [feedbacks, setFeedbacks] = useState({})
	const [variableDefinitions, setVariableDefinitions] = useState({})
	const [variableValues, setVariableValues] = useState({})

	useEffect(() => {
		if (socket) {
			socketEmit(socket, 'modules_get', []).then(([res]) => {
				const modulesObj = {}
				for (const mod of res.modules) {
					modulesObj[mod.name] = mod
				}
				setModules(modulesObj)
			}).catch((e) => {
				console.error('Failed to load modules list', e)
			})
			socketEmit(socket, 'variable_instance_definitions_get', []).then(([data]) => {
				setVariableDefinitions(data || {})
			}).catch((e) => {
				console.error('Failed to load variable definitions list', e)
			})
			socketEmit(socket, 'variables_get', []).then(([data]) => {
				setVariableValues(data || {})
			}).catch((e) => {
				console.error('Failed to load variable values list', e)
			})

			const updateVariableDefinitions = (label, variables) => {
				setVariableDefinitions(oldDefinitions => ({
					...oldDefinitions,
					[label]: variables,
				}))
			}
		
			const updateVariableValue = (key, value) => {
				setVariableValues(oldValues => ({
					...oldValues,
					[key]: value,
				}))
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

	const contextValue = {
		socket: socket,
		instances: instances,
		modules: modules,
		variableDefinitions: variableDefinitions,
		variableValues: variableValues,
		actions: actions,
		feedbacks: feedbacks,
	}

	return <CompanionContext.Provider value={contextValue} >
		{ children}
	</CompanionContext.Provider>
}