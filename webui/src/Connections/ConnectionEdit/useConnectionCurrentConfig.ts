import { ClientEditConnectionConfig } from '@companion-app/shared/Model/Common.js'
import { useQuery, UseQueryResult } from '@tanstack/react-query'
import { useContext } from 'react'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'

export function useConnectionCurrentConfig(connectionId: string): UseQueryResult<ClientEditConnectionConfig> {
	const { socket } = useContext(RootAppStoreContext)

	const query = useQuery({
		queryKey: ['connections:edit', connectionId],
		queryFn: async () => {
			const data = await socket.emitPromise('connections:edit', [connectionId]).catch((e) => {
				throw new Error(`Failed to load connection info: "${e}"`)
			})

			if (!data) {
				throw new Error(`Connection config unavailable`)
			}

			return data
		},
		retryDelay: 2000,
		retry: 3, // Retry 3 times before reporting an error
		refetchOnMount: true,
	})

	return query
}
