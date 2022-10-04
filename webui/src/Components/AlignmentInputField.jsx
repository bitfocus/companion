import React from 'react'
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
	return (
		<div className="alignmentinput">
			{ALIGMENT_OPTIONS.map((align) => {
				return (
					<div
						key={align}
						className={classnames({ selected: align === value  })}
						onClick={() => setValue(align)}
					>
						&nbsp;
					</div>
				)
			})}
		</div>
	)
}
