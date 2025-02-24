import { EntityModelType, SomeEntityModel } from '@companion-app/shared/Model/EntityModel.js'
import { action, makeObservable, observable } from 'mobx'
import { useEffect, useMemo } from 'react'
import type { DropdownChoiceInt } from '../LocalVariableDefinitions.js'
import { computedFn } from 'mobx-utils'

export class LocalVariablesStore {
	readonly controlId: string

	#variables = observable.map<string, SomeEntityModel>()

	constructor(controlId: string) {
		this.controlId = controlId

		makeObservable(this, {
			setEntities: action,
		})
	}

	setEntities(localVariables: SomeEntityModel[]) {
		this.#variables.replace(localVariables.map((v) => [v.id, v]))
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
				if (entity.type !== EntityModelType.LocalVariable) continue
				if (!entity.options.name) continue

				dynamicVariables.push({
					value: `local:${entity.options.name}`,
					label: entity.options.description || entity.options.name,
				})
			}

			return [...fixedVariables, ...dynamicVariables]
		}
	)
}

export function useLocalVariablesStore(controlId: string, localVariables: SomeEntityModel[] | null) {
	const store = useMemo(() => new LocalVariablesStore(controlId), [controlId])

	useEffect(() => {
		if (localVariables) store.setEntities(localVariables)
	}, [store, localVariables])

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
	{
		value: 'this:step',
		label: 'The current step of this button',
	},
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
