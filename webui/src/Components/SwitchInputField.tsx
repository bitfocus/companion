import { CFormLabel, CFormSwitch } from '@coreui/react'
import { useCallback } from 'react'

interface SwitchInputFieldProps {
	id?: string
	tooltip?: string
	value: boolean
	setValue: (value: boolean) => void
	disabled?: boolean
	small?: boolean
	inline?: boolean
}

export function SwitchInputField({
	id,
	tooltip,
	value,
	setValue,
	disabled,
	small,
	inline,
}: SwitchInputFieldProps): React.JSX.Element {
	const onChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			setValue(!!e.currentTarget.checked)
		},
		[setValue]
	)

	return (
		<CFormSwitch
			id={id}
			color="success"
			checked={value}
			size={small ? undefined : 'xl'}
			disabled={disabled}
			title={tooltip}
			onChange={onChange}
			className={inline ? 'form-switch-inline' : undefined}
		/>
	)
}

export interface SwitchInputFieldWithLabelProps extends Omit<SwitchInputFieldProps, 'inline'> {
	className?: string
	label: string | React.ReactNode
}

export function SwitchInputFieldWithLabel({
	className,
	label,
	...props
}: SwitchInputFieldWithLabelProps): React.JSX.Element {
	return (
		<div className={`switch-input-with-label ${className}`}>
			<SwitchInputField {...props} inline />
			<CFormLabel title={props.tooltip}>{label}</CFormLabel>
		</div>
	)
}
