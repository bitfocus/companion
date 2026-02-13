import type { DropdownChoice, DropdownChoiceId } from '@companion-app/shared/Model/Common.js'
import type { GroupBase, OptionsOrGroups } from 'react-select'
import type { Writable } from 'type-fest'
import { useComputed } from '~/Resources/util'

export interface DropdownChoiceGroup {
	label: string
	options: DropdownChoice[]
}

export type DropdownChoicesOrGroups =
	| DropdownChoice[]
	| DropdownChoiceGroup[]
	| Array<DropdownChoice | DropdownChoiceGroup>
	| Record<string, DropdownChoice>

export interface DropdownChoiceInt {
	value: DropdownChoiceId
	label: string
}

export type OptionsOrGroupsInt = OptionsOrGroups<DropdownChoiceInt, GroupBase<DropdownChoiceInt>>

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
						label: item.label,
						options: item.options.map((choice): DropdownChoiceInt => ({ value: choice.id, label: choice.label })),
					}
					options.push(group)
					flatOptions.push(...group.options)
				} else {
					// Flat choice
					options.push({ value: item.id, label: item.label })
					flatOptions.push({ value: item.id, label: item.label })
				}
			}

			return {
				options,
				flatOptions,
			}
		} else if (typeof choices === 'object') {
			const options = Object.values(choices).map(
				(choice): DropdownChoiceInt => ({ value: choice.id, label: choice.label })
			)
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
