import { useContext } from 'react'
import { ConfigContext, ConfigContextType } from '~/contexts/ConfigContext'

export function useConfig(): ConfigContextType {
	const context = useContext(ConfigContext)
	if (context === undefined) {
		throw new Error('useConfig must be used within a ConfigProvider')
	}
	return context
}
