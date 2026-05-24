import {
	AlignHorizontalJustifyCenter,
	AlignHorizontalJustifyEnd,
	AlignHorizontalJustifyStart,
	AlignVerticalJustifyCenter,
	AlignVerticalJustifyEnd,
	AlignVerticalJustifyStart,
} from 'lucide-react'
import { Button, ButtonGroup } from './Button'

interface SplitAlignmentInputFieldProps {
	id: string | undefined
	value: string
	setValue: (value: string) => void
	disabled?: boolean
}

export function HorizontalAlignmentInputField({
	id,
	value,
	setValue,
	disabled = false,
}: SplitAlignmentInputFieldProps): React.JSX.Element {
	return (
		<ButtonGroup id={id} aria-label="Horizontal alignment">
			<AlignmentButton
				value={value}
				setValue={setValue}
				buttonValue={'left'}
				title="Left"
				disabled={disabled}
				tabIndex={0}
			>
				<AlignHorizontalJustifyStart size="1.3rem" />
			</AlignmentButton>
			<AlignmentButton
				value={value}
				setValue={setValue}
				buttonValue={'center'}
				title="Center"
				disabled={disabled}
				tabIndex={0}
			>
				<AlignHorizontalJustifyCenter size="1.3rem" />
			</AlignmentButton>
			<AlignmentButton
				value={value}
				setValue={setValue}
				buttonValue={'right'}
				title="Right"
				disabled={disabled}
				tabIndex={0}
			>
				<AlignHorizontalJustifyEnd size="1.3rem" />
			</AlignmentButton>
		</ButtonGroup>
	)
}

export function VerticalAlignmentInputField({
	id,
	value,
	setValue,
	disabled = false,
}: SplitAlignmentInputFieldProps): React.JSX.Element {
	return (
		<ButtonGroup id={id} aria-label="Vertical alignment">
			<AlignmentButton
				value={value}
				setValue={setValue}
				buttonValue={'top'}
				title="Top"
				disabled={disabled}
				tabIndex={0}
			>
				<AlignVerticalJustifyStart size="1.3rem" />
			</AlignmentButton>
			<AlignmentButton
				value={value}
				setValue={setValue}
				buttonValue={'center'}
				title="Center"
				disabled={disabled}
				tabIndex={0}
			>
				<AlignVerticalJustifyCenter size="1.3rem" />
			</AlignmentButton>
			<AlignmentButton
				value={value}
				setValue={setValue}
				buttonValue={'bottom'}
				title="Bottom"
				disabled={disabled}
				tabIndex={0}
			>
				<AlignVerticalJustifyEnd size="1.3rem" />
			</AlignmentButton>
		</ButtonGroup>
	)
}

interface AlignmentButtonProps {
	value: string
	setValue: (value: string) => void
	disabled: boolean
	buttonValue: string
	title: string
	tabIndex: number
}

function AlignmentButton({
	value,
	setValue,
	buttonValue,
	title,
	disabled,
	tabIndex,
	children,
}: React.PropsWithChildren<AlignmentButtonProps>) {
	return (
		<Button
			color={value === buttonValue ? 'primary' : 'secondary'}
			onClick={() => setValue(buttonValue)}
			title={title}
			aria-label={title}
			disabled={disabled}
			tabIndex={tabIndex}
		>
			{children}
		</Button>
	)
}
