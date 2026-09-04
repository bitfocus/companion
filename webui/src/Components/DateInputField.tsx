import { Input } from '@base-ui/react'
import './datetime-field.css'
import { formatLocalDate, toDateInputValue } from './DateInputValue.js'

interface DateInputFieldProps {
	id: string | undefined
	value: string | null
	setValue: (value: string | null) => void
	disabled: boolean
}

export function DateInputField({ id, value, setValue, disabled }: DateInputFieldProps): React.JSX.Element {
	return (
		<Input
			id={id}
			type="date"
			required
			disabled={disabled}
			min={formatLocalDate(new Date())}
			className="form-input datetime-input-field"
			value={toDateInputValue(value)}
			onChange={(e) => setValue(e.currentTarget.value === '' ? null : e.currentTarget.value)}
		/>
	)
}
