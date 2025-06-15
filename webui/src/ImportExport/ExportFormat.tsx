import React, { memo } from 'react'
import { DropdownInputField } from '~/Components/DropdownInputField.js'
import type { ExportFormat } from '@companion-app/shared/Model/ExportFormat.js'
import type { DropdownChoice, DropdownChoiceId } from '@companion-module/base'

// eslint-disable-next-line react-refresh/only-export-components
export const ExportFormatDefault: ExportFormat = 'json-gz'
const formatOptions: DropdownChoice[] = [
	{
		id: 'json-gz',
		label: 'Compressed (Default)',
	},
	{
		id: 'json',
		label: 'JSON (Standard)',
	},
	{
		id: 'yaml',
		label: 'YAML (More human readable)',
	},
]

interface SelectExportFormatProps {
	value: ExportFormat
	setValue: (value: ExportFormat) => void
	/** @deprecated */
	label?: string
}

export const SelectExportFormat = memo(function SelectExportFormat({
	value,
	setValue,
	label,
}: SelectExportFormatProps) {
	return (
		<DropdownInputField
			choices={formatOptions}
			value={value}
			setValue={setValue as (value: DropdownChoiceId) => void}
			label={label}
		/>
	)
})
