import React from 'react'
import classnames from 'classnames'
import type { CompanionAlignment } from '@companion-module/base'

const ALIGNMENT_OPTIONS: CompanionAlignment[] = [
	'left:top',
	'center:top',
	'right:top',
	'left:center',
	'center:center',
	'right:center',
	'left:bottom',
	'center:bottom',
	'right:bottom',
]

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
