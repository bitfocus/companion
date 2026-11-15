/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useMemo } from 'react'
import type { SomeControlId } from '@companion-app/shared/ControlId.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import type { IEntityEditorService } from '~/Services/Controls/ControlEntitiesService.js'
import type { EntityListActionContext, LocalVariablesStore } from '../LocalVariablesStore.js'

/** Which local variables are outputs, in a custom action, where each user value can be one */
export interface LocalVariableOutputs {
	/** The label of each output, by the name of its local variable */
	readonly labels: ReadonlyMap<string, string>
	/** Make a local variable an output, change its label, or stop it being one with null */
	setOutput: (variableName: string, label: string | null) => void
}

export interface EntityEditorContextType {
	/** The control the entities belong to, or null when they don't belong to one (eg an action recording) */
	controlId: SomeControlId | null
	location: ControlLocation | undefined
	serviceFactory: IEntityEditorService
	readonly: boolean
	localVariablesStore: LocalVariablesStore | null
	localVariablePrefix: string | null
	/** When set, inline expression previews show a compact validity status instead of the value (shown elsewhere) */
	previewStatusOnly?: boolean
	/** This editor's relationship to an action set, gating the execution-context `this:*` variables. */
	actionContext: EntityListActionContext
	/** When set, its user value local variables can be outputs, as in a custom action */
	localVariableOutputs?: LocalVariableOutputs
}

const EntityEditorContext = createContext<EntityEditorContextType | null>(null)

export function useEntityEditorContext(): EntityEditorContextType {
	const ctx = useContext(EntityEditorContext)
	if (!ctx) throw new Error('useEntityEditorContext must be used within a EntityEditorProvider')
	return ctx
}

/** Like useEntityEditorContext, but returns null instead of throwing when used outside a provider */
export function useOptionalEntityEditorContext(): EntityEditorContextType | null {
	return useContext(EntityEditorContext)
}

type EntityEditorContextProviderProps = EntityEditorContextType

export function EntityEditorContextProvider({
	controlId,
	location,
	serviceFactory,
	readonly,
	localVariablesStore,
	localVariablePrefix,
	previewStatusOnly,
	actionContext,
	localVariableOutputs,
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
			previewStatusOnly,
			actionContext,
			localVariableOutputs,
		}
	}, [
		controlId,
		location,
		serviceFactory,
		readonly,
		localVariablesStore,
		localVariablePrefix,
		previewStatusOnly,
		actionContext,
		localVariableOutputs,
	])

	return <EntityEditorContext.Provider value={value}>{children}</EntityEditorContext.Provider>
}
