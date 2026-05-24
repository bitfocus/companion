import TimePicker from 'react-time-picker'

interface TimeInputFieldProps {
	id: string | undefined
	value: string | null
	setValue: (value: string | null) => void
	disabled: boolean
}

export function TimeInputField({ id, value, setValue, disabled }: TimeInputFieldProps): React.JSX.Element {
	return (
		<TimePicker
			id={id}
			disabled={disabled}
			format="HH:mm:ss"
			maxDetail="second"
			required
			value={value}
			onChange={setValue}
			openClockOnFocus={false}
		/>
	)
}
