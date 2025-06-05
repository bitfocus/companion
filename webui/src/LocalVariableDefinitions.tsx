import { DropdownChoiceId } from '@companion-module/base'

export interface DropdownChoiceInt {
	value: DropdownChoiceId
	label: string
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
		value: 'this:step_count',
		label: 'The number of steps on this button',
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
