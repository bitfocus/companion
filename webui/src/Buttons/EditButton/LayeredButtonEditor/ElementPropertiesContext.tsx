import React, { createContext } from 'react'
import { LocalVariablesStore } from '~/Controls/LocalVariablesStore.js'

export interface ElementPropertiesContextValue {
	controlId: string
	localVariablesStore: LocalVariablesStore
}

// eslint-disable-next-line react-refresh/only-export-components
export const ElementPropertiesContext = createContext<ElementPropertiesContextValue | null>(null)

export interface ElementPropertiesProviderProps {
	controlId: string
	localVariablesStore: LocalVariablesStore
	children: React.ReactNode
}

export const ElementPropertiesProvider = ({
	controlId,
	localVariablesStore,
	children,
}: ElementPropertiesProviderProps): React.ReactElement => {
	const value: ElementPropertiesContextValue = {
		controlId,
		localVariablesStore,
	}

	return <ElementPropertiesContext.Provider value={value}>{children}</ElementPropertiesContext.Provider>
}
