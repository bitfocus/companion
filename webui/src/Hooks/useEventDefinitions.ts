import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { trpc } from '~/Resources/TRPC'
import type { EventDefinitionsStore } from '~/Stores/EventDefinitionsStore'

export function useEventDefinitions(store: EventDefinitionsStore): boolean {
	const { data, isSuccess } = useQuery(trpc.instances.definitions.events.queryOptions(undefined, {}))

	useEffect(() => {
		store.setDefinitions(data)
	}, [store, data, isSuccess])

	return isSuccess
}
