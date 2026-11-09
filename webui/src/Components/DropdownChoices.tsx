import type { Writable } from 'type-fest'
import type { DropdownChoice, DropdownChoiceId } from '@companion-app/shared/Model/Common.js'
import { useComputed } from '~/Resources/util'

export interface GroupBase<Option> {
	readonly options: readonly Option[]
	readonly label?: string
}

export interface DropdownChoiceGroup<TId extends DropdownChoiceId = DropdownChoiceId> {
	label: string
	options: DropdownChoice<TId>[]
}

export type DropdownChoicesOrGroups<TId extends DropdownChoiceId = DropdownChoiceId> =
	| DropdownChoice<TId>[]
	| DropdownChoiceGroup<TId>[]
	| Array<DropdownChoice<TId> | DropdownChoiceGroup<TId>>
	| Record<string, DropdownChoice<TId>>

export interface DropdownChoiceInt {
	value: DropdownChoiceId
	label: string
	disabled?: boolean
}

export type OptionsOrGroupsInt = readonly (DropdownChoiceInt | GroupBase<DropdownChoiceInt>)[]

export function useDropdownChoicesForSelect(choices: DropdownChoicesOrGroups): {
	options: OptionsOrGroupsInt
	flatOptions: DropdownChoiceInt[]
} {
	return useComputed(() => {
		if (Array.isArray(choices)) {
			const options: Writable<OptionsOrGroupsInt> = []
			const flatOptions: DropdownChoiceInt[] = []
			for (const item of choices) {
				if ('options' in item) {
					// Grouped choices
					const group: GroupBase<DropdownChoiceInt> = {
						label: String(item.label),
						options: item.options.map((choice): DropdownChoiceInt => ({
							value: choice.id,
							label: String(choice.label),
							disabled: choice.disabled,
						})),
					}
					options.push(group)
					flatOptions.push(...group.options)
				} else {
					// Flat choice
					const option: DropdownChoiceInt = { value: item.id, label: String(item.label), disabled: item.disabled }
					options.push(option)
					flatOptions.push(option)
				}
			}

			return {
				options,
				flatOptions,
			}
		} else if (typeof choices === 'object') {
			const options = Object.values(choices).map((choice): DropdownChoiceInt => ({
				value: choice.id,
				label: String(choice.label),
				disabled: choice.disabled,
			}))
			return {
				options,
				flatOptions: options,
			}
		} else {
			return {
				options: [],
				flatOptions: [],
			}
		}
	}, [choices])
}
