import { useCallback, useEffect, useState } from 'react'
import { safeSetLocalStorage } from '~/Helpers/SafeStorage.js'

export interface TableVisibilityHelper<T extends Record<string, any>> {
	visibility: T
	toggleVisibility: (key: keyof T, forceState?: boolean) => void
}

export function useTableVisibilityHelper<T extends Record<string, any>>(
	localStorageKey: string,
	defaultValue: T
): TableVisibilityHelper<T> {
	const [visibility, setVisibility] = useState<T>(() => {
		try {
			const rawConfig = window.localStorage.getItem(localStorageKey)
			if (rawConfig !== null) {
				return JSON.parse(rawConfig) ?? {}
			}
		} catch (e) {
			console.error('Failed to parse localStorage item', e)
		}

		// setup defaults
		safeSetLocalStorage(localStorageKey, JSON.stringify(defaultValue))

		return structuredClone(defaultValue)
	})

	const toggleVisibility = useCallback(
		(key: keyof T, forceState?: boolean) => {
			setVisibility((oldConfig) => ({
				...oldConfig,
				[key]: typeof forceState === 'boolean' ? forceState : !oldConfig[key],
			}))
		},
		[setVisibility]
	)

	// Save the config when it changes
	useEffect(() => {
		safeSetLocalStorage(localStorageKey, JSON.stringify(visibility))
	}, [localStorageKey, visibility])

	return {
		visibility,
		toggleVisibility,
	}
}
