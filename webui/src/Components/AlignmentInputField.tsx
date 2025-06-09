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

interface AlignmentInputFieldProps2 {
	value: string
	setValue: (value: string) => void
}

export function HorizontalAlignmentInputField({ value, setValue }: AlignmentInputFieldProps2) {
	return (
		<CButtonGroup>
			<AlignmentButton value={value} setValue={setValue} buttonValue={'left'} title="Left">
				<AlignLeftIcon />
			</AlignmentButton>
			<AlignmentButton value={value} setValue={setValue} buttonValue={'center'} title="Center">
				<AlignCenterHorizontallyIcon />
			</AlignmentButton>
			<AlignmentButton value={value} setValue={setValue} buttonValue={'right'} title="Right">
				<AlignRightIcon />
			</AlignmentButton>
		</CButtonGroup>
	)
}

export function VerticalAlignmentInputField({ value, setValue }: AlignmentInputFieldProps2) {
	return (
		<CButtonGroup>
			<AlignmentButton value={value} setValue={setValue} buttonValue={'top'} title="Top">
				<AlignTopIcon />
			</AlignmentButton>
			<AlignmentButton value={value} setValue={setValue} buttonValue={'center'} title="Center">
				<AlignCenterVerticallyIcon />
			</AlignmentButton>
			<AlignmentButton value={value} setValue={setValue} buttonValue={'bottom'} title="Bottom">
				<AlignBottomIcon />
			</AlignmentButton>
		</CButtonGroup>
	)
}

interface AlignmentButtonProps extends AlignmentInputFieldProps2 {
	buttonValue: string
	title: string
}

function AlignmentButton({
	value,
	setValue,
	buttonValue,
	title,
	children,
}: React.PropsWithChildren<AlignmentButtonProps>) {
	return (
		<CButton
			color={value === buttonValue ? 'primary' : 'secondary'}
			onClick={() => setValue(buttonValue)}
			title={title}
		>
			{children}
		</CButton>
	)
}
