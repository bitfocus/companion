import React, { createContext } from 'react'
import { LocalVariablesStore } from '~/Controls/LocalVariablesStore.js'

export type IsPropertyOverridden = (elementId: string, elementProperty: string) => boolean

export interface ElementPropertiesContextValue {
	controlId: string
	localVariablesStore: LocalVariablesStore
	isPropertyOverridden: IsPropertyOverridden
}

// eslint-disable-next-line react-refresh/only-export-components
export const ElementPropertiesContext = createContext<ElementPropertiesContextValue | null>(null)

export interface ElementPropertiesProviderProps {
	controlId: string
	localVariablesStore: LocalVariablesStore
	isPropertyOverridden: IsPropertyOverridden
	children: React.ReactNode
}

export const ElementPropertiesProvider = ({
	controlId,
	localVariablesStore,
	isPropertyOverridden,
	children,
}: ElementPropertiesProviderProps): React.ReactElement => {
	const value: ElementPropertiesContextValue = {
		controlId,
		localVariablesStore,
		isPropertyOverridden,
	}

	return <ElementPropertiesContext.Provider value={value}>{children}</ElementPropertiesContext.Provider>
}
