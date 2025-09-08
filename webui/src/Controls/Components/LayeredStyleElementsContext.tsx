import React, { createContext, useContext } from 'react'
import { LayeredStyleStore } from '~/Buttons/EditButton/LayeredButtonEditor/StyleStore.js'

export interface LayeredStyleElementsContextValue {
	styleStore: LayeredStyleStore
}

// eslint-disable-next-line react-refresh/only-export-components
export const LayeredStyleElementsContext = createContext<LayeredStyleElementsContextValue | null>(null)

export interface LayeredStyleElementsProviderProps {
	styleStore: LayeredStyleStore
	children: React.ReactNode
}

export const LayeredStyleElementsProvider = ({
	styleStore,
	children,
}: LayeredStyleElementsProviderProps): React.ReactElement => {
	const value: LayeredStyleElementsContextValue = {
		styleStore,
	}

	return <LayeredStyleElementsContext.Provider value={value}>{children}</LayeredStyleElementsContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useLayeredStyleElementsContext(): LayeredStyleElementsContextValue {
	const context = useContext(LayeredStyleElementsContext)
	if (!context) {
		throw new Error('useLayeredStyleElementsContext must be used within a LayeredStyleElementsProvider')
	}
	return context
}
