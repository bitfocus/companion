import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { EventDefinitionsStore } from '~/Stores/EventDefinitionsStore'
import { trpc } from '~/TRPC'

export function useEventDefinitions(store: EventDefinitionsStore): boolean {
	const query = useQuery(trpc.connections.definitions.events.queryOptions(undefined, {}))

	useEffect(() => {
		store.setDefinitions(query.data)
	}, [query.data, query.isSuccess])

	return query.isSuccess
}
