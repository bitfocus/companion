import DatePicker from 'react-date-picker'

interface DateInputFieldProps {
	id: string | undefined
	value: Date | null
	setValue: (value: Date | null) => void
	disabled: boolean
}

export function DateInputField({ id, value, setValue, disabled }: DateInputFieldProps): React.JSX.Element {
	return (
		<DatePicker
			id={id}
			disabled={disabled}
			format="yyyy-M-dd"
			minDate={new Date()}
			required
			value={value}
			onChange={setValue as any} // We don't enable ranges
			showLeadingZeros={true}
			calendarIcon={null}
			yearPlaceholder="yyyy"
			monthPlaceholder="mm"
			dayPlaceholder="dd"
		/>
	)
}
