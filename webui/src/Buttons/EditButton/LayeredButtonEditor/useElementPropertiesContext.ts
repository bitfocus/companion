import { useContext } from 'react'
import { ElementPropertiesContext, ElementPropertiesContextValue } from './ElementPropertiesContext.js'

export function useElementPropertiesContext(): ElementPropertiesContextValue {
	const context = useContext(ElementPropertiesContext)
	if (!context) {
		throw new Error('useElementPropertiesContext must be used within an ElementPropertiesProvider')
	}
	return context
}
