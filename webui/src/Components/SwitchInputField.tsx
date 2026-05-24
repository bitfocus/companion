import { Switch } from '@base-ui/react/switch'
import classNames from 'classnames'
import { useId } from 'react'
import type { SetOptional } from 'type-fest'
import { FormLabel } from '~/Components/Form.js'

interface SwitchInputFieldProps {
	id: string | undefined
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

export interface SwitchInputFieldWithLabelProps extends SetOptional<SwitchInputFieldProps, 'id'> {
	className?: string
	label: string | React.ReactNode
}

export function SwitchInputFieldWithLabel({
	className,
	label,
	...props
}: SwitchInputFieldWithLabelProps): React.JSX.Element {
	const id = useId() // Fallback id in case one isn't provided, ensuring the label is always associated with the checkbox

	return (
		<div className={`switch-input-with-label ${className}`}>
			<SwitchInputField {...props} id={props.id || id} />
			<FormLabel title={props.tooltip} className="m-0 ms-1" htmlFor={props.id || id}>
				{label}
			</FormLabel>
		</div>
	)
}
