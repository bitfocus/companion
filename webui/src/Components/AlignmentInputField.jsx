import React, { useEffect } from 'react'
import classnames from 'classnames'

const ALIGMENT_OPTIONS = [
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

export function AlignmentInputField({ definition, value, setValue }) {
	// If the value is undefined, populate with the default. Also inform the parent about the validity
	useEffect(() => {
		if (value === undefined && definition.default !== undefined) {
			setValue(definition.default)
		}
	}, [definition.default, value, setValue])

	return (
		<div className="alignmentinput">
			{ALIGMENT_OPTIONS.map((align) => {
				return (
					<div
						key={align}
						className={classnames({ selected: align === value ?? definition.default })}
						onClick={() => setValue(align)}
					>
						&nbsp;
					</div>
				)
			})}
		</div>
	)
}
