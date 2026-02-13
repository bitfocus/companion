import React from 'react'
import { components as SelectComponents, type OptionProps } from 'react-select'
import type { DropdownChoiceInt } from './DropdownChoices'

// Formatting for variable pulldown options:
export const CustomOption = React.memo((props: OptionProps<DropdownChoiceInt>) => {
	const { data } = props
	return (
		<SelectComponents.Option {...props} className={(props.className ?? '') + 'variable-dropdown-option'}>
			<span className="var-name">{data.value}</span>
			<span className="var-label">{data.label}</span>
		</SelectComponents.Option>
	)
})

// Formatting for variable "single value" (shown when dropdown is closed) -- uses a different CSS class
export const CustomSingleValue = React.memo((props: OptionProps<DropdownChoiceInt>) => {
	const { data } = props
	return (
		<SelectComponents.SingleValue {...props} className={(props.className ?? '') + 'variable-dropdown-single'}>
			<div className="var-name">{data.value}</div>
			<div className="var-label">{data.label}</div>
		</SelectComponents.SingleValue>
	)
})
