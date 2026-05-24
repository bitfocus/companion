import { memo } from 'react'
import type { DropdownChoice, DropdownChoiceId } from '@companion-app/shared/Model/Common.js'
import type { ExportFormat } from '@companion-app/shared/Model/ExportFormat.js'
import { SimpleDropdownInputField } from '~/Components/DropdownInputFieldSimple'

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
	id: string
	value: ExportFormat
	setValue: (value: ExportFormat) => void
}

export const SelectExportFormat = memo(function SelectExportFormat({ id, value, setValue }: SelectExportFormatProps) {
	return (
		<SimpleDropdownInputField
			id={id}
			choices={formatOptions}
			value={value}
			setValue={setValue as (value: DropdownChoiceId) => void}
		/>
	)
})
