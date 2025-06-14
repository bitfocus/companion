import { CButton } from '@coreui/react'
import classNames from 'classnames'
import { cloneDeep } from 'lodash-es'
import React from 'react'
import { useCallback, useEffect, useState } from 'react'

export interface TableVisibilityHelper<T extends Record<string, any>> {
	visibility: T
	toggleVisibility: (key: keyof T, forceState?: boolean) => void
}

// eslint-disable-next-line react-refresh/only-export-components
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
		window.localStorage.setItem(localStorageKey, JSON.stringify(defaultValue))

		return cloneDeep(defaultValue)
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
		window.localStorage.setItem(localStorageKey, JSON.stringify(visibility))
	}, [localStorageKey, visibility])

	return {
		visibility,
		toggleVisibility,
	}
}

interface VisibilityButtonProps<T extends Record<string, boolean>> extends TableVisibilityHelper<T> {
	keyId: keyof T
	color: string
	label: string
	title?: string
}

export function VisibilityButton<T extends Record<string, any>>({
	keyId,
	color,
	label,
	title,
	visibility,
	toggleVisibility,
}: VisibilityButtonProps<T>): React.JSX.Element {
	const doToggle = useCallback(() => toggleVisibility(keyId), [keyId, toggleVisibility])

	return (
		<CButton
			size="sm"
			color={color}
			className={classNames({ active: visibility[keyId] })}
			onClick={doToggle}
			title={title}
		>
			{label}
		</CButton>
	)
}
