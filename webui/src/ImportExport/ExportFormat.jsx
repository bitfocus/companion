import { DropdownInputField } from '../Components/DropdownInputField'

export const ExportFormatDefault = 'json-gz'
const formatOptions = [
	{
		id: 'json-gz',
		label: 'Compressed',
	},
	{
		id: 'json',
		label: 'Uncompressed',
	},
]

export function SelectExportFormat({ value, setValue }) {
	return <DropdownInputField choices={formatOptions} value={value} setValue={setValue} />
}
