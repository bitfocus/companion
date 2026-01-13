import { useContext } from 'react'
import { RootAppStoreContext } from './RootAppStore.js'
import { useComputed } from '~/Resources/util.js'
import type { ClientConnectionConfig } from '@companion-app/shared/Model/Connections.js'

export interface ClientConnectionConfigWithId extends ClientConnectionConfig {
	id: string
}

export function useSortedConnectionsThatHaveVariables(): ClientConnectionConfigWithId[] {
	const { variablesStore, connections } = useContext(RootAppStoreContext)

	return useComputed(() => {
		return connections.sortedConnections().filter((connection) => {
			const connectionVariables = variablesStore.variables.get(connection.label)
			return connectionVariables && connectionVariables.size > 0
		})
	}, [variablesStore.variables, connections.connections])
}
