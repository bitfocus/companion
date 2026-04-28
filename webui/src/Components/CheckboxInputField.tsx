import { Checkbox } from '@base-ui/react/checkbox'
import { CFormLabel } from '@coreui/react'

interface CheckboxInputFieldProps {
	id?: string
	tooltip?: string
	value: boolean
	indeterminate?: boolean
	setValue: (value: boolean) => void
	onBlur?: React.FocusEventHandler<HTMLSpanElement>
	disabled?: boolean
}

export function CheckboxInputField({
	id,
	tooltip,
	value,
	indeterminate,
	setValue,
	onBlur,
	disabled,
}: CheckboxInputFieldProps): React.JSX.Element {
	return (
		<Checkbox.Root
			id={id}
			checked={!!value}
			onCheckedChange={setValue}
			disabled={disabled}
			indeterminate={indeterminate}
			className="checkbox-field"
			title={tooltip}
			onBlur={onBlur}
		>
			<Checkbox.Indicator className="checkbox-field-indicator" />
		</Checkbox.Root>
	)
}

export interface CheckboxInputFieldWithLabelProps extends CheckboxInputFieldProps {
	className?: string
	label: string | React.ReactNode
}

export function CheckboxInputFieldWithLabel({
	className,
	label,
	...props
}: CheckboxInputFieldWithLabelProps): React.JSX.Element {
	return (
		<div className={`checkbox-input-with-label ${className}`}>
			<CheckboxInputField {...props} />
			<CFormLabel title={props.tooltip} className="ms-1">
				{label}
			</CFormLabel>
		</div>
	)
}
