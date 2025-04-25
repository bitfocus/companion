import React from 'react'
import classnames from 'classnames'
import type { CompanionAlignment } from '@companion-module/base'
import { ALIGNMENT_OPTIONS } from '@companion-app/shared/Model/Alignment.js'
import { CButton, CButtonGroup } from '@coreui/react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faAlignCenter, faAlignLeft, faAlignRight, IconDefinition } from '@fortawesome/free-solid-svg-icons'

interface AlignmentInputFieldProps {
	value: CompanionAlignment
	setValue: (value: CompanionAlignment) => void
}

export function AlignmentInputField({ value, setValue }: AlignmentInputFieldProps) {
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
			<AlignmentButton icon={faAlignLeft} value={value} setValue={setValue} buttonValue={'left'} title="Left" />
			<AlignmentButton icon={faAlignCenter} value={value} setValue={setValue} buttonValue={'center'} title="Center" />
			<AlignmentButton icon={faAlignRight} value={value} setValue={setValue} buttonValue={'right'} title="Right" />
		</CButtonGroup>
	)
}

export function VerticalAlignmentInputField({ value, setValue }: AlignmentInputFieldProps2) {
	return (
		<CButtonGroup>
			<AlignmentButton icon={faAlignLeft} value={value} setValue={setValue} buttonValue={'top'} title="Top" />
			<AlignmentButton icon={faAlignCenter} value={value} setValue={setValue} buttonValue={'center'} title="Center" />
			<AlignmentButton icon={faAlignRight} value={value} setValue={setValue} buttonValue={'bottom'} title="Bottom" />
		</CButtonGroup>
	)
}

interface AlignmentButtonProps extends AlignmentInputFieldProps2 {
	icon: IconDefinition
	buttonValue: string
	title: string
}

function AlignmentButton({ icon, value, setValue, buttonValue, title }: AlignmentButtonProps) {
	return (
		<CButton
			color={value === buttonValue ? 'primary' : 'secondary'}
			onClick={() => setValue(buttonValue)}
			title={title}
		>
			<FontAwesomeIcon icon={icon} />
		</CButton>
	)
}
