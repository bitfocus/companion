import { observable, runInAction, type ObservableMap } from 'mobx'
import { useEffect, useMemo } from 'react'
import type { CompanionVariableValue } from '@companion-app/shared/Model/Common.js'
import { useQuery } from '@tanstack/react-query'
import { trpc } from '~/Resources/TRPC'

export function useVariablesValuesForLabel(label: string): ObservableMap<string, CompanionVariableValue | undefined> {
	const valuesStore = useMemo(() => observable.map<string, CompanionVariableValue | undefined>(), [])

	const query = useQuery(
		trpc.variables.values.connection.queryOptions(
			{
				label,
			},
			{
				refetchInterval: 1000,
				refetchOnMount: 'always',
				refetchOnReconnect: 'always',
			}
		)
	)

	useEffect(() => {
		runInAction(() => {
			valuesStore.replace(query.data || {})
		})
	}, [valuesStore, query.data, query.isError])

	return valuesStore
}
