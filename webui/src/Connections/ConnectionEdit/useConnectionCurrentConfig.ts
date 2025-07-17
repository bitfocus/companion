import { ClientEditConnectionConfig } from '@companion-app/shared/Model/Common.js'
import { useQuery, UseQueryResult } from '@tanstack/react-query'
import { trpc } from '~/Resources/TRPC'

export function useConnectionCurrentConfig(connectionId: string): UseQueryResult<ClientEditConnectionConfig> {
	const query = useQuery(
		trpc.connections.edit.queryOptions(
			{ connectionId },
			{
				retryDelay: 2000,
				retry: 3, // Retry 3 times before reporting an error
				refetchOnMount: true,
			}
		)
	)

	return query as UseQueryResult<ClientEditConnectionConfig> // TODO - avoid this cast, with some type reworking
}
