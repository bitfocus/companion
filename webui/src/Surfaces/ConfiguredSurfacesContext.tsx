import { createContext, useContext } from 'react'

// note: lint doesn't like non-component exports in a file that exports components, so these are put in a separate file
type booleanFn = (a: boolean) => void

export const ConfiguredSurfaceContext = createContext<{ setShowSettings: booleanFn } | null>(null)

export const useConfiguredSurfaceContext = (): booleanFn => {
	const context = useContext(ConfiguredSurfaceContext)
	if (!context) {
		throw new Error('useConfiguredSurfaceContext must be used within a ConfiguredSurfaceContext provider')
	}

	return context.setShowSettings
}
