/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useMemo } from 'react'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import type { IEntityEditorService } from '~/Services/Controls/ControlEntitiesService.js'
import type { LocalVariablesStore } from '../LocalVariablesStore.js'

export interface EntityEditorContextType {
	controlId: string
	location: ControlLocation | undefined
	serviceFactory: IEntityEditorService
	readonly: boolean
	localVariablesStore: LocalVariablesStore | null
	localVariablePrefix: string | null
}

const EntityEditorContext = createContext<EntityEditorContextType | null>(null)

export function useEntityEditorContext(): EntityEditorContextType {
	const ctx = useContext(EntityEditorContext)
	if (!ctx) throw new Error('useEntityEditorContext must be used within a EntityEditorProvider')
	return ctx
}

type EntityEditorContextProviderProps = EntityEditorContextType

export function EntityEditorContextProvider({
	controlId,
	location,
	serviceFactory,
	readonly,
	localVariablesStore,
	localVariablePrefix,
	children,
}: React.PropsWithChildren<EntityEditorContextProviderProps>): React.JSX.Element {
	const value = useMemo<EntityEditorContextType>(() => {
		return {
			controlId,
			location,
			serviceFactory,
			readonly,
			localVariablesStore,
			localVariablePrefix,
		}
	}, [controlId, location, serviceFactory, readonly, localVariablesStore, localVariablePrefix])

	return <EntityEditorContext.Provider value={value}>{children}</EntityEditorContext.Provider>
}
