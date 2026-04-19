/* eslint-disable react-refresh/only-export-components */
import type { ObservableMap } from 'mobx'
import { createContext, useContext, useMemo } from 'react'
import type { VariableValue } from '@companion-app/shared/Model/Variables.js'
import type { CustomVariablesApi } from './CustomVariablesApi'

export interface CustomVariablesTableContextType {
	customVariablesApi: CustomVariablesApi
	customVariableValues: ObservableMap<string, VariableValue | undefined>
}

const CustomVariablesTableContext = createContext<CustomVariablesTableContextType | null>(null)

export function useCustomVariablesTableContext(): CustomVariablesTableContextType {
	const ctx = useContext(CustomVariablesTableContext)
	if (!ctx) throw new Error('useCustomVariablesTableContext must be used within a CustomVariablesTableProvider')
	return ctx
}

type CustomVariablesTableContextProviderProps = CustomVariablesTableContextType

export function CustomVariablesTableContextProvider({
	customVariablesApi,
	customVariableValues,
	children,
}: React.PropsWithChildren<CustomVariablesTableContextProviderProps>): React.JSX.Element {
	const value = useMemo<CustomVariablesTableContextType>(() => {
		return {
			customVariablesApi,
			customVariableValues,
		}
	}, [customVariablesApi, customVariableValues])

	return <CustomVariablesTableContext.Provider value={value}>{children}</CustomVariablesTableContext.Provider>
}
