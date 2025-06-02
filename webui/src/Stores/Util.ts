import { useContext } from 'react'
import { RootAppStoreContext } from './RootAppStore.js'
import { useComputed } from '~/util.js'
import { ClientConnectionConfig } from '@companion-app/shared/Model/Connections.js'

export interface ClientConnectionConfigWithId extends ClientConnectionConfig {
	id: string
}

export function useSortedConnectionsThatHaveVariables(): ClientConnectionConfigWithId[] {
	const { variablesStore, connections } = useContext(RootAppStoreContext)

	return useComputed(() => {
		const result: ClientConnectionConfigWithId[] = []

		for (const [id, connection] of connections.connections) {
			const connectionVariables = variablesStore.variables.get(connection.label)
			if (connectionVariables && connectionVariables.size > 0) {
				result.push({ ...connection, id })
			}
		}

		return result.sort((a, b) => a.sortOrder - b.sortOrder)
	}, [variablesStore.variables, connections.connections])
}
