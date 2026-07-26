import { useQuery } from '@tanstack/react-query'
import { action, makeObservable, observable } from 'mobx'
import { computedFn } from 'mobx-utils'
import { useContext, useEffect, useMemo } from 'react'
import type { Equal, Expect } from 'type-testing'
import { CreatePageControlId, ParseControlId } from '@companion-app/shared/ControlId.js'
import type { ThisLocationVariable, ThisPageVariable } from '@companion-app/shared/ControlLocation.js'
import { EntityModelType, type SomeEntityModel } from '@companion-app/shared/Model/EntityModel.js'
import type { VariableValue, VariableValues } from '@companion-app/shared/Model/Variables.js'
import type { DropdownChoiceInt } from '~/Components/DropdownChoices.js'
import { useControlConfig } from '~/Hooks/useControlConfig.js'
import { trpc } from '~/Resources/TRPC.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'

export class LocalVariablesStore {
	readonly controlId: string

	#variables = observable.map<string, SomeEntityModel>()
	/** The variables owned by this control's page, exposed to it as `$(page:x)` (grid controls only). */
	#pageVariables = observable.map<string, SomeEntityModel>()
	#values = observable.map<string, VariableValue | undefined>()

	constructor(controlId: string) {
		this.controlId = controlId

		makeObservable(this, {
			setEntities: action,
			setPageVariables: action,
		})
	}

	setEntities(localVariables: SomeEntityModel[]): void {
		this.#variables.replace(localVariables.map((v): [string, SomeEntityModel] => [v.id, v]))
	}

	setPageVariables(pageVariables: SomeEntityModel[]): void {
		this.#pageVariables.replace(pageVariables.map((v): [string, SomeEntityModel] => [v.id, v]))
	}

	setValues(values: VariableValues): void {
		this.#values.replace(Object.entries(values))
	}

	getValue = (variableName: string): VariableValue | undefined => {
		return this.#values.get(variableName)
	}

	getOptions = computedFn(
		(entityType: EntityModelType | null, internalParser: boolean, isLocatedInGrid: boolean): DropdownChoiceInt[] => {
			const isPageControl = ParseControlId(this.controlId)?.type === 'page'

			let fixedVariables: DropdownChoiceInt[] = []

			if (isLocatedInGrid) {
				fixedVariables = ControlLocalVariables
				if (internalParser && entityType === EntityModelType.Action) {
					fixedVariables = ControlWithInternalLocalVariables
				}
			} else if (isPageControl) {
				// A page control has no grid location, but its variables belong to a page
				fixedVariables = PageLocalVariables
			}

			const dynamicVariables: DropdownChoiceInt[] = []

			// A page control's own variables are exposed as `$(page:x)`; any other control's as `$(local:x)`
			const ownNamespace = isPageControl ? 'page' : 'local'
			for (const entity of this.#variables.values()) {
				const choice = entityToVariableChoice(entity, ownNamespace)
				if (choice) dynamicVariables.push(choice)
			}

			// A control can also reference its page's variables as `$(page:x)`. These are local-scoped like,
			// so they share the caller's local-variable gate.
			for (const entity of this.#pageVariables.values()) {
				const choice = entityToVariableChoice(entity, 'page')
				if (choice) dynamicVariables.push(choice)
			}

			return [...fixedVariables, ...dynamicVariables]
		}
	)
}

/** Build a `$(namespace:name)` picker choice for a value-feedback entity, or null if it is not a usable variable. */
function entityToVariableChoice(entity: SomeEntityModel, namespace: string): DropdownChoiceInt | null {
	if (entity.type !== EntityModelType.Feedback) return null
	if (entity.disabled || !entity.variableName) return null

	return {
		value: `${namespace}:${entity.variableName}`,
		label: entity.headline || entity.variableName,
	}
}

/** The variables owned by a page's `page:<id>` control, for offering `$(page:x)` suggestions to its controls. */
function usePageVariableEntities(pageNumber: number | null | undefined): SomeEntityModel[] | null {
	const { pages } = useContext(RootAppStoreContext)
	const pageInfo = pageNumber != null ? pages.get(pageNumber) : undefined
	const pageControlId = pageInfo ? CreatePageControlId(pageInfo.id) : null

	const { controlConfig } = useControlConfig(pageControlId)
	const config = controlConfig?.config
	return config?.type === 'page' ? config.localVariables : null
}

export function useLocalVariablesStore(
	controlId: string,
	localVariables: SomeEntityModel[] | null,
	pageNumber?: number | null
): LocalVariablesStore {
	const store = useMemo(() => new LocalVariablesStore(controlId), [controlId])

	useEffect(() => {
		if (localVariables) store.setEntities(localVariables)
	}, [store, localVariables])

	const pageVariables = usePageVariableEntities(pageNumber)
	useEffect(() => {
		store.setPageVariables(pageVariables ?? [])
	}, [store, pageVariables])

	const query = useQuery(
		trpc.controls.entities.localVariableValues.queryOptions(
			{
				controlId,
			},
			{
				refetchInterval: 1000,
				refetchOnWindowFocus: true,
				refetchOnMount: true,
			}
		)
	)

	useEffect(() => {
		store.setValues(query.data || {})
	}, [query.data, store])

	return store
}

export const ControlLocalVariables = [
	{
		value: 'this:page',
		label: 'This page',
	},
	{
		value: 'this:column',
		label: 'This column',
	},
	{
		value: 'this:row',
		label: 'This row',
	},
	{
		value: 'this:location',
		label: 'This location (eg 1/2/3)',
	},
	{
		value: 'this:active',
		label: 'Whether the button is in the pushed state',
	},
	{
		value: 'this:step',
		label: 'The current step of this button',
	},
	{
		value: 'this:step_count',
		label: 'The number of step of this button',
	},
	{
		value: 'this:button_status',
		label: 'The status of this button',
	},
	{
		value: 'this:actions_running',
		label: 'Whether actions are running from this button',
	},
	{
		value: 'this:page_name',
		label: 'This page name',
	},
] as const satisfies DropdownChoiceInt[]

// @ts-expect-error Type used only to assert a type condition
type _VerifyControlVariablesDropdownIsComplete = Expect<
	Equal<(typeof ControlLocalVariables)[number]['value'], ThisLocationVariable>
>

export const ControlWithInternalLocalVariables: DropdownChoiceInt[] = [
	...ControlLocalVariables,
	{
		value: 'this:surface_id',
		label: 'The id of the surface triggering this action',
	},
]

/** The subset of `this:*` variables that make sense for a page control (no grid location). */
export const PageLocalVariables = [
	{ value: 'this:page', label: 'This page' },
	{ value: 'this:page_name', label: 'This page name' },
] as const satisfies DropdownChoiceInt[]

// @ts-expect-error Type used only to assert a type condition
type _VerifyPageVariablesDropdownIsComplete = Expect<
	Equal<(typeof PageLocalVariables)[number]['value'], ThisPageVariable>
>

/** Variable picker entry injected for fields that use deferred parsing (e.g. set-value actions). */
export const DeferredParsingContextVariables: DropdownChoiceInt[] = [
	{ value: 'this:current', label: 'Current value of this variable' },
]
