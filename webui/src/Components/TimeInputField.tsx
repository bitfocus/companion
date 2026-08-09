import { Input } from '@base-ui/react'
import './datetime-field.css'

interface TimeInputFieldProps {
	id: string | undefined
	value: string | null
	setValue: (value: string | null) => void
	disabled: boolean
}

export function TimeInputField({ id, value, setValue, disabled }: TimeInputFieldProps): React.JSX.Element {
	return (
		<Input
			id={id}
			type="time"
			step="1" // show + require the seconds segment, so the value is "HH:mm:ss"
			required
			disabled={disabled}
			className="form-input datetime-input-field"
			value={value ?? ''}
			onChange={(e) => setValue(e.currentTarget.value === '' ? null : e.currentTarget.value)}
		/>
	)
}
