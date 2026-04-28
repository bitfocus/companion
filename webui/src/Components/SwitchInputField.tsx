import { Switch } from '@base-ui/react/switch'
import { CFormLabel } from '@coreui/react'
import classNames from 'classnames'

interface SwitchInputFieldProps {
	id?: string
	tooltip?: string
	value: boolean
	setValue: (value: boolean) => void
	disabled?: boolean
	small?: boolean
	// dimmed?: boolean
}

export function SwitchInputField({
	id,
	tooltip,
	value,
	setValue,
	disabled,
	small,
	// dimmed,
}: SwitchInputFieldProps): React.JSX.Element {
	return (
		<Switch.Root
			id={id}
			className={classNames('switch-input', {
				'switch-input-small': small,
				// 'switch-input-dimmed': dimmed,
			})}
			checked={value}
			onCheckedChange={setValue}
			disabled={disabled}
			title={tooltip}
		>
			<Switch.Thumb className="switch-thumb" />
		</Switch.Root>
	)
}

export interface SwitchInputFieldWithLabelProps extends SwitchInputFieldProps {
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
			<SwitchInputField {...props} />
			<CFormLabel title={props.tooltip}>{label}</CFormLabel>
		</div>
	)
}
