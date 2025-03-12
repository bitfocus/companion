import { DropdownChoiceId } from '@companion-module/base'

export interface DropdownChoiceInt {
	value: DropdownChoiceId
	label: string
}

export const SurfaceLocalVariables: DropdownChoiceInt[] = [
	{
		value: 'this:page',
		label: 'This page',
	},
	{
		value: 'this:surface_id',
		label: 'The id of this surface',
	},
	{
		value: 'this:page_name',
		label: 'This page name',
	},
]
