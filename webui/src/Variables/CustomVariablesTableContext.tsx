import React, { createContext, useContext, useMemo } from 'react'
import type { CustomVariablesApi } from './CustomVariablesApi'
import { ObservableMap } from 'mobx'
import type { CompanionVariableValue } from '@companion-module/base'

export interface CustomVariablesTableContextType {
	customVariablesApi: CustomVariablesApi
	customVariableValues: ObservableMap<string, CompanionVariableValue | undefined>
}

const CustomVariablesTableContext = createContext<CustomVariablesTableContextType | null>(null)

export function useCustomVariablesTableContext() {
	const ctx = useContext(CustomVariablesTableContext)
	if (!ctx) throw new Error('useCustomVariablesTableContext must be used within a CustomVariablesTableProvider')
	return ctx
}

interface CustomVariablesTableContextProviderProps extends CustomVariablesTableContextType {}

export function CustomVariablesTableContextProvider({
	customVariablesApi,
	customVariableValues,
	children,
}: React.PropsWithChildren<CustomVariablesTableContextProviderProps>) {
	const value = useMemo<CustomVariablesTableContextType>(() => {
		return {
			customVariablesApi,
			customVariableValues,
		}
	}, [customVariablesApi, customVariableValues])

	return <CustomVariablesTableContext.Provider value={value}>{children}</CustomVariablesTableContext.Provider>
}
