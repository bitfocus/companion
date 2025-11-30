import React, { createContext, useReducer, useEffect, useState, type ReactNode } from 'react'
import type { ConfigData } from '~/types/config'

interface ConfigState {
	data: ConfigData | null
	isLoading: boolean
	error: string | null
}

type ConfigAction =
	| { type: 'LOADING' }
	| { type: 'SUCCESS'; payload: ConfigData }
	| { type: 'ERROR'; payload: string }
	| { type: 'UPDATE_CONFIG'; payload: Partial<ConfigData['config']> }

const initialState: ConfigState = {
	data: null,
	isLoading: true,
	error: null,
}

const configReducer = (state: ConfigState, action: ConfigAction): ConfigState => {
	switch (action.type) {
		case 'LOADING':
			return {
				...state,
				isLoading: true,
				error: null,
			}
		case 'SUCCESS':
			return {
				data: action.payload,
				isLoading: false,
				error: null,
			}
		case 'ERROR':
			return {
				...state,
				isLoading: false,
				error: action.payload,
			}
		case 'UPDATE_CONFIG':
			return {
				...state,
				data: state.data
					? {
							...state.data,
							config: {
								...state.data.config,
								...action.payload,
							},
						}
					: null,
			}
		default:
			return state
	}
}

export interface ConfigContextType {
	state: ConfigState
	updateConfig: (config: Partial<ConfigData['config']>) => void
	refetchConfig: () => void
	hasUnsavedChanges: boolean
}

// eslint-disable-next-line react-refresh/only-export-components
export const ConfigContext = createContext<ConfigContextType | undefined>(undefined)

// Extend the global Window interface to include our API
declare global {
	interface Window {
		api: {
			send: (channel: string, data?: any) => void
			receive: (channel: string, func: (...args: any[]) => void) => void
		}
	}
}

interface ConfigProviderProps {
	children: ReactNode
}

export function ConfigProvider({ children }: ConfigProviderProps): JSX.Element {
	const [state, dispatch] = useReducer(configReducer, initialState)
	const [originalConfig, setOriginalConfig] = useState<ConfigData['config'] | null>(null)

	const updateConfig = (config: Partial<ConfigData['config']>) => {
		dispatch({ type: 'UPDATE_CONFIG', payload: config })

		// Save partial config immediately after updating
		if (window.api) {
			window.api.send('save-config', config)
		}
	}

	// Check if there are unsaved changes
	const hasUnsavedChanges =
		originalConfig && state.data ? JSON.stringify(originalConfig) !== JSON.stringify(state.data.config) : false

	const fetchConfig = () => {
		dispatch({ type: 'LOADING' })

		if (!window.api) {
			dispatch({ type: 'ERROR', payload: 'IPC API not available' })
			return
		}

		// Request config from the main process
		window.api.send('info')
	}

	const refetchConfig = () => {
		fetchConfig()
	}

	useEffect(() => {
		// Set up IPC listeners
		const handleConfigResponse = (
			config: ConfigData['config'],
			appInfo: ConfigData['appInfo'],
			platform: string,
			hostname: string
		) => {
			const configData: ConfigData = {
				config,
				appInfo,
				platform,
				hostname,
			}
			dispatch({ type: 'SUCCESS', payload: configData })
			// Update original config when data is loaded
			setOriginalConfig(config)
		}

		const handleError = (error: string) => {
			dispatch({ type: 'ERROR', payload: error })
		}

		// Listen for responses from the main process
		window.api.receive('info', handleConfigResponse)
		window.api.receive('config-error', handleError)

		// Initial fetch
		fetchConfig()
	}, [dispatch])

	const contextValue: ConfigContextType = {
		state,
		updateConfig,
		refetchConfig,
		hasUnsavedChanges,
	}

	return <ConfigContext.Provider value={contextValue}>{children}</ConfigContext.Provider>
}
