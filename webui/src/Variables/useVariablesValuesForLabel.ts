import { observable, runInAction, type ObservableMap } from 'mobx'
import { useEffect, useMemo } from 'react'
import type { VariableValue } from '@companion-app/shared/Model/Variables.js'
import { useQuery } from '@tanstack/react-query'
import { trpc } from '~/Resources/TRPC'

export function useVariablesValuesForLabel(label: string): ObservableMap<string, VariableValue | undefined> {
	const valuesStore = useMemo(() => observable.map<string, VariableValue | undefined>(), [])

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
