import React, { ChangeEvent } from 'react'
import PropTypes from 'prop-types'
import classNames from 'classnames'

interface CSwitchProps {
	className?: string
	innerRef?: React.LegacyRef<HTMLInputElement>
	size?: '' | 'lg' | 'sm'
	shape?: '' | 'pill' | 'square'
	variant?: '' | '3d' | 'opposite' | 'outline'
	color?: string
	labelOn?: string
	labelOff?: string
	title?: string
	disabled?: boolean
	checked: boolean
	onChange: (e: ChangeEvent<HTMLInputElement>) => void
	tooltip?: string
}

//component - CoreUI / CSwitch
const CSwitch = (props: CSwitchProps) => {
	let {
		className,
		//
		innerRef,
		size,
		color,
		labelOn,
		labelOff,
		variant,
		shape,
		...attributes
	} = props

	//render
	const classes = classNames(
		'c-switch form-check-label',
		(labelOn || labelOff) && 'c-switch-label',
		size && `c-switch-${size}`,
		shape && `c-switch-${shape}`,
		color && `c-switch${variant ? `-${variant}` : ''}-${color}`,
		className
	)

	const inputClasses = classNames('c-switch-input', 'c-form-check-input')

	return (
		<label className={classes}>
			<input className={inputClasses} type="checkbox" {...attributes} ref={innerRef} />
			<span className="c-switch-slider" data-checked={labelOn} data-unchecked={labelOff} title={attributes.title} />
		</label>
	)
}

CSwitch.propTypes = {
	className: PropTypes.oneOfType([PropTypes.string, PropTypes.array, PropTypes.object]),
	//
	innerRef: PropTypes.oneOfType([PropTypes.object, PropTypes.func]),
	size: PropTypes.oneOf(['', 'lg', 'sm']),
	shape: PropTypes.oneOf(['', 'pill', 'square']),
	variant: PropTypes.oneOf(['', '3d', 'opposite', 'outline']),
	color: PropTypes.string,
	labelOn: PropTypes.string,
	labelOff: PropTypes.string,
	title: PropTypes.string,
}

export default CSwitch
