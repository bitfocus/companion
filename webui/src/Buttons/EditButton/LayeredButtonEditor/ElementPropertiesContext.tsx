import React, { createContext } from 'react'
import type { LocalVariablesStore } from '~/Controls/LocalVariablesStore.js'

export type IsPropertyOverridden = (elementId: string, elementProperty: string) => boolean

export interface ElementPropertiesContextValue {
	controlId: string
	localVariablesStore: LocalVariablesStore
	isPropertyOverridden: IsPropertyOverridden
	/**
	 * Whether these fields are the pinned view rather than an element's own panel. Everything in the pinned
	 * view is pinned by definition, so it doesn't mark up which properties are.
	 */
	isPinnedView: boolean
}

// eslint-disable-next-line react-refresh/only-export-components
export const ElementPropertiesContext = createContext<ElementPropertiesContextValue | null>(null)

export interface ElementPropertiesProviderProps {
	controlId: string
	localVariablesStore: LocalVariablesStore
	isPropertyOverridden: IsPropertyOverridden
	isPinnedView: boolean
	children: React.ReactNode
}

export const ElementPropertiesProvider = ({
	controlId,
	localVariablesStore,
	isPropertyOverridden,
	isPinnedView,
	children,
}: ElementPropertiesProviderProps): React.ReactElement => {
	const value: ElementPropertiesContextValue = {
		controlId,
		localVariablesStore,
		isPropertyOverridden,
		isPinnedView,
	}

	return <ElementPropertiesContext.Provider value={value}>{children}</ElementPropertiesContext.Provider>
}
