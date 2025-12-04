import { EntityModelType, SomeEntityModel } from '@companion-app/shared/Model/EntityModel.js'
import type { CompanionVariableValue, CompanionVariableValues } from '@companion-module/base'
import { action, makeObservable, observable } from 'mobx'
import { useEffect, useMemo } from 'react'
import type { DropdownChoiceInt } from '../LocalVariableDefinitions.js'
import { computedFn } from 'mobx-utils'
import { useQuery } from '@tanstack/react-query'
import { trpc } from '~/Resources/TRPC.js'

export class LocalVariablesStore {
	readonly controlId: string

	#variables = observable.map<string, SomeEntityModel>()
	#values = observable.map<string, CompanionVariableValue | undefined>()

	constructor(controlId: string) {
		this.controlId = controlId

		makeObservable(this, {
			setEntities: action,
		})
	}

	setEntities(localVariables: SomeEntityModel[]): void {
		this.#variables.replace(localVariables.map((v) => [v.id, v]))
	}

	setValues(values: CompanionVariableValues): void {
		this.#values.replace(Object.entries(values))
	}

	getValue = (variableName: string): CompanionVariableValue | undefined => {
		return this.#values.get(variableName)
	}

	getOptions = computedFn(
		(entityType: EntityModelType | null, isInternal: boolean, isLocatedInGrid: boolean): DropdownChoiceInt[] => {
			let fixedVariables: DropdownChoiceInt[] = []

			if (isLocatedInGrid) {
				fixedVariables = ControlLocalVariables
				if (isInternal && entityType === EntityModelType.Action) {
					fixedVariables = InternalActionLocalVariables
				}
			}

			const dynamicVariables: DropdownChoiceInt[] = []
			for (const entity of this.#variables.values()) {
				if (entity.type !== EntityModelType.Feedback) continue
				if (entity.disabled || !entity.variableName) continue

				dynamicVariables.push({
					value: `local:${entity.variableName}`,
					label: entity.headline || entity.variableName,
				})
			}

			return [...fixedVariables, ...dynamicVariables]
		}
	)
}

export function useLocalVariablesStore(
	controlId: string,
	localVariables: SomeEntityModel[] | null
): LocalVariablesStore {
	const store = useMemo(() => new LocalVariablesStore(controlId), [controlId])

	useEffect(() => {
		if (localVariables) store.setEntities(localVariables)
	}, [store, localVariables])

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

export const ControlLocalVariables: DropdownChoiceInt[] = [
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
	// {
	// 	value: 'this:pushed',
	// 	label: 'Whether the button is in the pushed state',
	// },
	{
		value: 'this:step',
		label: 'The current step of this button',
	},
	{
		value: 'this:step_count',
		label: 'The number of step of this button',
	},
	// {
	// 	value: 'this:button_status',
	// 	label: 'The status of this button',
	// },
	// {
	// 	value: 'this:actions_running',
	// 	label: 'Whether actions are running from this button',
	// },
	{
		value: 'this:page_name',
		label: 'This page name',
	},
]

export const InternalActionLocalVariables: DropdownChoiceInt[] = [
	...ControlLocalVariables,
	{
		value: 'this:surface_id',
		label: 'The id of the surface triggering this action',
	},
]
