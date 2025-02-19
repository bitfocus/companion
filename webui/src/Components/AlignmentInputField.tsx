import React from 'react'
import classnames from 'classnames'
import type { CompanionAlignment } from '@companion-module/base'
import { ALIGNMENT_OPTIONS } from '@companion-app/shared/Model/Alignment.js'

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
