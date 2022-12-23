import { useState, useEffect, useCallback, useContext } from 'react'
import { SketchPicker } from '@hello-pangea/color-picker'
import { createPortal } from 'react-dom'
import { useOnClickOutsideExt } from '../util'
import { usePopper } from 'react-popper'
import { MenuPortalContext } from './DropdownInputField'

function splitColors(number) {
	return {
		r: (number >> 16) & 0xff,
		g: (number >> 8) & 0xff,
		b: number & 0xff,
	}
}

export function ColorInputField({ value, setValue, setValid, disabled }) {
	const menuPortal = useContext(MenuPortalContext)

	const [currentColor, setCurrentColor] = useState(null)
	const [displayPicker, setDisplayPicker] = useState(false)

	// If the value is undefined, populate with the default. Also inform the parent about the validity
	useEffect(() => {
		setValid?.(true)
	}, [setValid])

	const handleClick = useCallback((e) => setDisplayPicker((d) => !d), [])
	const setHide = useCallback((e) => {
		if (e) {
			e.preventDefault()
			e.stopPropagation()
		}

		setDisplayPicker(false)
	}, [])

	const onChange = useCallback(
		(c) => {
			const newValue = parseInt(c.hex.substr(1), 16)
			console.log('change', newValue)
			setValue(newValue)
			setValid?.(true)
			setCurrentColor(newValue)
		},
		[setValue, setValid]
	)

	const onChangeComplete = useCallback(
		(c) => {
			const newValue = parseInt(c.hex.substr(1), 16)
			console.log('complete', newValue)
			setValue(newValue)
			setValid?.(true)
			setCurrentColor(null)
		},
		[setValue, setValid]
	)

	const color = splitColors(currentColor ?? value ?? 0)

	const styles = {
		color: {
			width: '36px',
			height: '14px',
			borderRadius: '2px',
			background: `rgb(${color.r}, ${color.g}, ${color.b})`,
		},
		swatch: {
			padding: '5px',
			background: '#fff',
			borderRadius: '1px',
			boxShadow: '0 0 0 1px rgba(0,0,0,.1)',
			display: 'inline-block',
			cursor: 'pointer',
		},
	}

	const [referenceElement, setReferenceElement] = useState(null)
	const [popperElement, setPopperElement] = useState(null)
	const { styles: popperStyles, attributes } = usePopper(referenceElement, popperElement)
	useOnClickOutsideExt([{ current: referenceElement }, { current: popperElement }], setHide)

	return (
		<div style={{ lineHeight: 0 }}>
			<div style={styles.swatch} onClick={handleClick} ref={setReferenceElement}>
				<div style={styles.color} />
			</div>
			{displayPicker &&
				createPortal(
					<div ref={setPopperElement} style={{ ...popperStyles.popper, zIndex: 3 }} {...attributes.popper}>
						<SketchPicker
							disabled={disabled}
							color={color}
							onChange={onChange}
							onChangeComplete={onChangeComplete}
							disableAlpha={true}
							presetColors={PICKER_COLORS}
						/>
					</div>,
					menuPortal || document.body
				)}
		</div>
	)
}

const PICKER_COLORS = [
	//Grey
	'#000000',
	'#242424',
	'#484848',
	'#6E6E6E',
	'#929292',
	'#B6B6B6',
	'#DADADA',
	'#FFFFFF',
	//Red
	'#330000',
	'#660000',
	'#990000',
	'#CC0000',
	'#FF0000',
	'#FF4040',
	'#FF8080',
	'#FFC0C0',
	//Orange
	'#331900',
	'#663300',
	'#994C00',
	'#CC6500',
	'#FF8000',
	'#FF9F40',
	'#FFBF80',
	'#FFDFC0',
	//Yellow
	'#333300',
	'#666600',
	'#999900',
	'#CCCC00',
	'#FFFF00',
	'#FFFF40',
	'#FFFF80',
	'#FFFFC0',
	//Green
	'#003300',
	'#006600',
	'#009900',
	'#00CC00',
	'#00FF00',
	'#40FF40',
	'#80FF80',
	'#C0FFC0',
	//Blue
	'#000033',
	'#000066',
	'#000099',
	'#0000CC',
	'#0000FF',
	'#4040FF',
	'#8080FF',
	'#C0C0FF',
	//Purple
	'#330033',
	'#660066',
	'#990099',
	'#CC00CC',
	'#FF00FF',
	'#FF40FF',
	'#FF80FF',
	'#FFC0FF',
]
