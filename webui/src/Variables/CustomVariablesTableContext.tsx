/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useMemo } from 'react'
import type { CustomVariablesApi } from './CustomVariablesApi'
import type { ObservableMap } from 'mobx'
import type { CompanionVariableValue } from '@companion-app/shared/Model/Common.js'

export interface CustomVariablesTableContextType {
	customVariablesApi: CustomVariablesApi
	customVariableValues: ObservableMap<string, CompanionVariableValue | undefined>
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
