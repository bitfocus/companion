import { Checkbox } from '@base-ui/react/checkbox'
import { useId } from 'react'
import type { SetOptional } from 'type-fest'
import { FormLabel } from '~/Components/Form.js'

interface CheckboxInputFieldProps {
	id: string | undefined
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

export interface CheckboxInputFieldWithLabelProps extends SetOptional<CheckboxInputFieldProps, 'id'> {
	className?: string
	label: string | React.ReactNode
}

export function CheckboxInputFieldWithLabel({
	className,
	label,
	...props
}: CheckboxInputFieldWithLabelProps): React.JSX.Element {
	const id = useId() // Fallback id in case one isn't provided, ensuring the label is always associated with the checkbox

	return (
		<div className={`checkbox-input-with-label ${className || ''}`}>
			<CheckboxInputField {...props} id={props.id || id} />
			<FormLabel title={props.tooltip} className="m-0 ms-1" htmlFor={props.id || id}>
				{label}
			</FormLabel>
		</div>
	)
}
