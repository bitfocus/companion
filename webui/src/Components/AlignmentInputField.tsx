import classnames from 'classnames'
import {
	AlignHorizontalJustifyCenter,
	AlignHorizontalJustifyEnd,
	AlignHorizontalJustifyStart,
	AlignVerticalJustifyCenter,
	AlignVerticalJustifyEnd,
	AlignVerticalJustifyStart,
} from 'lucide-react'
import { ALIGNMENT_OPTIONS } from '@companion-app/shared/Model/Alignment.js'
import type { CompanionAlignment } from '@companion-module/base'
import { Button, ButtonGroup } from './Button'

interface AlignmentInputFieldProps {
	value: CompanionAlignment
	setValue: (value: CompanionAlignment) => void
}

export function AlignmentInputField({ value, setValue }: AlignmentInputFieldProps): React.JSX.Element {
	return (
		<div className="alignmentinput">
			{ALIGNMENT_OPTIONS.map((align) => {
				return (
					<div key={align} className={classnames({ selected: align === value })} onClick={() => setValue(align)}>
						&nbsp;
					</div>
				)
			})}
		</div>
	)
}

interface SplitAlignmentInputFieldProps {
	value: string
	setValue: (value: string) => void
	disabled?: boolean
}

export function HorizontalAlignmentInputField({
	value,
	setValue,
	disabled = false,
}: SplitAlignmentInputFieldProps): React.JSX.Element {
	return (
		<ButtonGroup>
			<AlignmentButton value={value} setValue={setValue} buttonValue={'left'} title="Left" disabled={disabled}>
				<AlignHorizontalJustifyStart size="1.3rem" />
			</AlignmentButton>
			<AlignmentButton value={value} setValue={setValue} buttonValue={'center'} title="Center" disabled={disabled}>
				<AlignHorizontalJustifyCenter size="1.3rem" />
			</AlignmentButton>
			<AlignmentButton value={value} setValue={setValue} buttonValue={'right'} title="Right" disabled={disabled}>
				<AlignHorizontalJustifyEnd size="1.3rem" />
			</AlignmentButton>
		</ButtonGroup>
	)
}

export function VerticalAlignmentInputField({
	value,
	setValue,
	disabled = false,
}: SplitAlignmentInputFieldProps): React.JSX.Element {
	return (
		<ButtonGroup>
			<AlignmentButton value={value} setValue={setValue} buttonValue={'top'} title="Top" disabled={disabled}>
				<AlignVerticalJustifyStart size="1.3rem" />
			</AlignmentButton>
			<AlignmentButton value={value} setValue={setValue} buttonValue={'center'} title="Center" disabled={disabled}>
				<AlignVerticalJustifyCenter size="1.3rem" />
			</AlignmentButton>
			<AlignmentButton value={value} setValue={setValue} buttonValue={'bottom'} title="Bottom" disabled={disabled}>
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
}

function AlignmentButton({
	value,
	setValue,
	buttonValue,
	title,
	disabled,
	children,
}: React.PropsWithChildren<AlignmentButtonProps>) {
	return (
		<Button
			color={value === buttonValue ? 'primary' : 'secondary'}
			onClick={() => setValue(buttonValue)}
			title={title}
			aria-label={title}
			disabled={disabled}
		>
			{children}
		</Button>
	)
}
