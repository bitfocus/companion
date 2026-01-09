import { createContext, useContext } from 'react'

// note: lint doesn't like non-component exports in a file that exports components, so these are put in a separate file
type booleanFn = (a: boolean) => void

export const ConfiguredSurfaceContext = createContext({ setShowSettings: (_a: boolean) => {} })

export const useConfiguredSurfaceContext = (): booleanFn => {
	const context = useContext(ConfiguredSurfaceContext)
	if (!context) {
		throw new Error('useConfiguredSurfaceContext must be used within a ConfiguredSurfaceContext provider')
	}
	if (!context.setShowSettings || typeof context.setShowSettings !== 'function') {
		throw new Error(
			'ConfiguredSurfaceContext provider must be an object with a setShowSettings property set to a function'
		)
	}
	return context.setShowSettings
}
