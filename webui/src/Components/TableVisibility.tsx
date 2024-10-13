import { CButton } from '@coreui/react'
import classNames from 'classnames'
import { cloneDeep } from 'lodash-es'
import React from 'react'
import { useCallback, useEffect, useState } from 'react'

export interface TableVisibilityHelper<T extends Record<string, boolean>> {
	visiblity: T
	toggleVisibility: (key: keyof T) => void
}

export function useTableVisibilityHelper<T extends Record<string, any>>(
	localStorageKey: string,
	defaultValue: T
): TableVisibilityHelper<T> {
	const [visiblity, setVisibility] = useState<T>(() => {
		try {
			const rawConfig = window.localStorage.getItem(localStorageKey)
			if (rawConfig !== null) {
				return JSON.parse(rawConfig) ?? {}
			}
		} catch (e) {}

		// setup defaults
		window.localStorage.setItem(localStorageKey, JSON.stringify(defaultValue))

		return cloneDeep(defaultValue)
	})

	const toggleVisibility = useCallback((key: keyof T) => {
		setVisibility((oldConfig) => ({
			...oldConfig,
			[key]: !oldConfig[key],
		}))
	}, [])

	// Save the config when it changes
	useEffect(() => {
		window.localStorage.setItem(localStorageKey, JSON.stringify(visiblity))
	}, [localStorageKey, visiblity])

	return {
		visiblity,
		toggleVisibility,
	}
}

interface VisibilityButtonProps<T extends Record<string, boolean>> extends TableVisibilityHelper<T> {
	keyId: keyof T
	color: string
	label: string
}

export function VisibilityButton<T extends Record<string, any>>({
	keyId,
	color,
	label,
	visiblity,
	toggleVisibility,
}: VisibilityButtonProps<T>) {
	const doToggle = useCallback(() => toggleVisibility(keyId), [keyId, toggleVisibility])

	return (
		<CButton size="sm" color={color} className={classNames({ active: visiblity[keyId] })} onClick={doToggle}>
			{label}
		</CButton>
	)
}
