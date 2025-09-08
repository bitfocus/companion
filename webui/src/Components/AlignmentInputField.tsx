import React from 'react'
import classnames from 'classnames'
import type { CompanionAlignment } from '@companion-module/base'
import { ALIGNMENT_OPTIONS } from '@companion-app/shared/Model/Alignment.js'
import { CButton, CButtonGroup } from '@coreui/react'
import {
	AlignBottomIcon,
	AlignCenterHorizontallyIcon,
	AlignCenterVerticallyIcon,
	AlignLeftIcon,
	AlignRightIcon,
	AlignTopIcon,
} from '@radix-ui/react-icons'

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
		<CButtonGroup>
			<AlignmentButton value={value} setValue={setValue} buttonValue={'left'} title="Left" disabled={disabled}>
				<AlignLeftIcon />
			</AlignmentButton>
			<AlignmentButton value={value} setValue={setValue} buttonValue={'center'} title="Center" disabled={disabled}>
				<AlignCenterHorizontallyIcon />
			</AlignmentButton>
			<AlignmentButton value={value} setValue={setValue} buttonValue={'right'} title="Right" disabled={disabled}>
				<AlignRightIcon />
			</AlignmentButton>
		</CButtonGroup>
	)
}

export function VerticalAlignmentInputField({
	value,
	setValue,
	disabled = false,
}: SplitAlignmentInputFieldProps): React.JSX.Element {
	return (
		<CButtonGroup>
			<AlignmentButton value={value} setValue={setValue} buttonValue={'top'} title="Top" disabled={disabled}>
				<AlignTopIcon />
			</AlignmentButton>
			<AlignmentButton value={value} setValue={setValue} buttonValue={'center'} title="Center" disabled={disabled}>
				<AlignCenterVerticallyIcon />
			</AlignmentButton>
			<AlignmentButton value={value} setValue={setValue} buttonValue={'bottom'} title="Bottom" disabled={disabled}>
				<AlignBottomIcon />
			</AlignmentButton>
		</CButtonGroup>
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
		<CButton
			color={value === buttonValue ? 'primary' : 'secondary'}
			onClick={() => setValue(buttonValue)}
			title={title}
			disabled={disabled}
		>
			{children}
		</CButton>
	)
}
