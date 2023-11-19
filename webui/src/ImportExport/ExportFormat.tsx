import React, { memo } from 'react'
import { DropdownInputField } from '../Components/DropdownInputField.js'
import type { ExportFormat } from '@companion/shared/Model/ExportFormat.js'
import { DropdownChoice, DropdownChoiceId } from '@companion-module/base'

export const ExportFormatDefault: ExportFormat = 'json-gz'
const formatOptions: DropdownChoice[] = [
	{
		id: 'json-gz',
		label: 'Compressed',
	},
	{
		id: 'json',
		label: 'Uncompressed',
	},
]

interface SelectExportFormatProps {
	value: ExportFormat
	setValue: (value: ExportFormat) => void
}

export const SelectExportFormat = memo(function SelectExportFormat({ value, setValue }: SelectExportFormatProps) {
	return (
		<DropdownInputField
			choices={formatOptions}
			value={value}
			multiple={false}
			setValue={setValue as (value: DropdownChoiceId) => void}
		/>
	)
})
