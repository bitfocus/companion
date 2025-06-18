import { observable, ObservableMap, runInAction } from 'mobx'
import { useContext, useEffect, useMemo } from 'react'
import type { CompanionVariableValue } from '@companion-module/base'
import { RootAppStoreContext } from '~/Stores/RootAppStore'

export function useCustomVariablesValues(): ObservableMap<string, CompanionVariableValue | undefined> {
	const { socket } = useContext(RootAppStoreContext)

	const valuesStore = useMemo(() => observable.map<string, CompanionVariableValue | undefined>(), [])

	useEffect(() => {
		const doPoll = () => {
			socket
				.emitPromise('variables:connection-values', ['custom'])
				.then((values) => {
					runInAction(() => {
						valuesStore.replace(values || {})
					})
				})
				.catch((e) => {
					runInAction(() => {
						valuesStore.clear()
					})
					console.log('Failed to fetch variable values: ', e)
				})
		}

		doPoll()
		const interval = setInterval(doPoll, 1000)

		return () => {
			runInAction(() => {
				valuesStore.clear()
			})

			clearInterval(interval)
		}
	}, [socket, valuesStore])

	return valuesStore
}
