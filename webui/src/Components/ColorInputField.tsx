import React, { useState, useCallback, useContext } from 'react'
import { ColorResult, SketchPicker } from '@hello-pangea/color-picker'
import { createPortal } from 'react-dom'
import { useOnClickOutsideExt } from '~/Resources/util.js'
import { usePopper } from 'react-popper'
import { MenuPortalContext } from './MenuPortalContext.js'
import { colord } from 'colord'
import { CompanionColorPresetValue } from '@companion-module/base'
import { CFormLabel } from '@coreui/react'
import { InlineHelp } from './InlineHelp.js'

function splitColor(color: number | string) {
	if (typeof color === 'number' || !isNaN(Number(color))) {
		color = Number(color)

		if (color > 0xffffff) {
			return {
				r: (color >> 16) & 0xff,
				g: (color >> 8) & 0xff,
				b: color & 0xff,
				a: (255 - ((color >> 24) & 0xff)) / 255,
			}
		} else {
			return {
				r: (color >> 16) & 0xff,
				g: (color >> 8) & 0xff,
				b: color & 0xff,
				a: 1,
			}
		}
	} else if (typeof color === 'string' && colord(color).isValid()) {
		const rgb = colord(color).toRgb()
		return {
			r: rgb.r,
			g: rgb.g,
			b: rgb.b,
			a: rgb.a,
		}
	} else {
		return {
			r: 0,
			g: 0,
			b: 0,
			a: 1,
		}
	}
}

const toReturnType = <T extends 'string' | 'number'>(
	value: ColorResult,
	returnType: 'string' | 'number'
): AsType<T> => {
	if (returnType === 'string') {
		return `rgba(${value.rgb.r}, ${value.rgb.g}, ${value.rgb.b}, ${value.rgb.a})` as any // TODO - typings
	} else {
		let colorNumber = parseInt(value.hex.substr(1), 16)
		if (value.rgb.a && value.rgb.a !== 1) {
			colorNumber += 0x1000000 * Math.round(255 * (1 - value.rgb.a)) // add possible transparency to number
		}
		return colorNumber as any // TODO - typings
	}
}

type AsType<T extends 'string' | 'number'> = T extends 'string' ? string : number

interface ColorInputFieldProps<T extends 'string' | 'number'> {
	label?: React.ReactNode
	value: AsType<T>
	setValue: (value: AsType<T>) => void
	disabled?: boolean
	enableAlpha?: boolean
	returnType: 'string' | 'number'
	presetColors?: CompanionColorPresetValue[]
	helpText?: string
}

export function ColorInputField<T extends 'string' | 'number'>({
	label,
	value,
	setValue,
	// disabled,
	enableAlpha,
	returnType,
	presetColors,
	helpText,
}: ColorInputFieldProps<T>): React.JSX.Element {
	const menuPortal = useContext(MenuPortalContext)

	const [currentColor, setCurrentColor] = useState<AsType<T> | null>(null)
	const [displayPicker, setDisplayPicker] = useState(false)

	const handleClick = useCallback(() => setDisplayPicker((d) => !d), [])
	const setHide = useCallback((e: MouseEvent) => {
		if (e) {
			e.preventDefault()
			e.stopPropagation()
		}

		setDisplayPicker(false)
	}, [])

	const onChange = useCallback(
		(c: ColorResult) => {
			const newValue = toReturnType<T>(c, returnType)
			setValue(newValue)
			setCurrentColor(newValue)
		},
		[setValue, returnType]
	)

	const onChangeComplete = useCallback(
		(c: ColorResult) => {
			const newValue = toReturnType<T>(c, returnType)
			setValue(newValue)
			setCurrentColor(null)
		},
		[setValue, returnType]
	)

	const color = splitColor(currentColor ?? value ?? 0)

	const styles = {
		color: {
			width: '36px',
			height: '32px',
			borderRadius: '3px',
			background: `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a})`,
		},
		swatch: {
			padding: '2px',
			background:
				'url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAMUlEQVQ4T2NkYGAQAWJ84A0+ScZRAxiGSRgQSAb40wkoDAgBvAlt1AAGcEIiBGgbiAAgXwixcH9GzgAAAABJRU5ErkJggg==") left center',
			backgroundClip: 'content-box',
			borderRadius: '3px',
			boxShadow: '0 0 0 1px rgba(0,0,0,.3)',
			display: 'inline-block',
			cursor: 'pointer',
		},
	}

	const [referenceElement, setReferenceElement] = useState<HTMLDivElement | null>(null)
	const [popperElement, setPopperElement] = useState<HTMLDivElement | null>(null)
	const { styles: popperStyles, attributes } = usePopper(referenceElement, popperElement)
	useOnClickOutsideExt([{ current: referenceElement }, { current: popperElement }], setHide)

	return (
		<>
			{helpText ? (
				<InlineHelp help={helpText}>{label ? <CFormLabel>{label}</CFormLabel> : ''}</InlineHelp>
			) : (
				<>{label ? <CFormLabel>{label}</CFormLabel> : ''}</>
			)}
			<div style={{ lineHeight: 0 }}>
				<div style={styles.swatch} onClick={handleClick} ref={setReferenceElement}>
					<div style={styles.color} />
				</div>
				{displayPicker &&
					createPortal(
						<div ref={setPopperElement} style={{ ...popperStyles.popper, zIndex: 3 }} {...attributes.popper}>
							<SketchPicker
								// disabled={disabled}
								color={color}
								onChange={onChange}
								onChangeComplete={onChangeComplete}
								disableAlpha={enableAlpha ? false : true}
								presetColors={Array.isArray(presetColors) ? (presetColors as any) : PICKER_COLORS}
							/>
						</div>,
						menuPortal || document.body
					)}
			</div>
		</>
	)
}

const PICKER_COLORS: CompanionColorPresetValue[] = [
	//Grey
	{ color: '#000000', title: 'Black' },
	{ color: '#242424', title: '14% White' },
	{ color: '#484848', title: '29% White' },
	{ color: '#6E6E6E', title: '43% White' },
	{ color: '#929292', title: '57% White' },
	{ color: '#B6B6B6', title: '71% White' },
	{ color: '#DADADA', title: '86% White' },
	{ color: '#FFFFFF', title: '100% White' },
	//Red
	{ color: '#330000', title: '20% Red' },
	{ color: '#660000', title: '40% Red' },
	{ color: '#990000', title: '60% Red' },
	{ color: '#CC0000', title: '80% Red' },
	{ color: '#FF0000', title: '100% Red' },
	{ color: '#FF4040', title: '-25% Red' },
	{ color: '#FF8080', title: '-50% Red' },
	{ color: '#FFC0C0', title: '-75% Red' },
	//Orange
	{ color: '#331900', title: '20% Orange' },
	{ color: '#663300', title: '40% Orange' },
	{ color: '#994C00', title: '60% Orange' },
	{ color: '#CC6500', title: '80% Orange' },
	{ color: '#FF8000', title: '100% Orange' },
	{ color: '#FF9F40', title: '-25% Orange' },
	{ color: '#FFBF80', title: '-50% Orange' },
	{ color: '#FFDFC0', title: '-75% Orange' },
	//Yellow
	{ color: '#333300', title: '20% Yellow' },
	{ color: '#666600', title: '40% Yellow' },
	{ color: '#999900', title: '60% Yellow' },
	{ color: '#CCCC00', title: '80% Yellow' },
	{ color: '#FFFF00', title: '100% Yellow' },
	{ color: '#FFFF40', title: '-25% Yellow' },
	{ color: '#FFFF80', title: '-50% Yellow' },
	{ color: '#FFFFC0', title: '-75% Yellow' },
	//Green
	{ color: '#003300', title: '20% Green' },
	{ color: '#006600', title: '40% Green' },
	{ color: '#009900', title: '60% Green' },
	{ color: '#00CC00', title: '80% Green' },
	{ color: '#00FF00', title: '100% Green' },
	{ color: '#40FF40', title: '-25% Green' },
	{ color: '#80FF80', title: '-50% Green' },
	{ color: '#C0FFC0', title: '-75% Green' },
	//Blue
	{ color: '#000033', title: '20% Blue' },
	{ color: '#000066', title: '40% Blue' },
	{ color: '#000099', title: '60% Blue' },
	{ color: '#0000CC', title: '80% Blue' },
	{ color: '#0000FF', title: '100% Blue' },
	{ color: '#4040FF', title: '-25% Blue' },
	{ color: '#8080FF', title: '-50% Blue' },
	{ color: '#C0C0FF', title: '-75% Blue' },
	//Purple
	{ color: '#330033', title: '20% Purple' },
	{ color: '#660066', title: '40% Purple' },
	{ color: '#990099', title: '60% Purple' },
	{ color: '#CC00CC', title: '80% Purple' },
	{ color: '#FF00FF', title: '100% Purple' },
	{ color: '#FF40FF', title: '-25% Purple' },
	{ color: '#FF80FF', title: '-50% Purple' },
	{ color: '#FFC0FF', title: '-75% Purple' },
]
