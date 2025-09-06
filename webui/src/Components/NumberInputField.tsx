import React, { useCallback, useState } from 'react'
import { CCol, CFormInput, CFormRange, CRow } from '@coreui/react'

interface NumberInputFieldProps {
	min?: number
	max?: number
	step?: number
	tooltip?: string
	range?: boolean
	value: number
	setValue: (value: number) => void
	disabled?: boolean
	checkValid?: (value: number) => boolean
	// When true, show the min value as a visual -∞ when value <= min
	showMinAsNegativeInfinity?: boolean
	// When true, show the max value as a visual ∞ when value >= max
	showMaxAsInfinity?: boolean
}

export function NumberInputField({
	min,
	max,
	step,
	tooltip,
	range,
	value,
	setValue,
	disabled,
	checkValid,
	showMinAsNegativeInfinity,
	showMaxAsInfinity,
}: NumberInputFieldProps): React.JSX.Element {
	const [tmpValue, setTmpValue] = useState<string | number | null>(null)
	const [focused, setFocused] = useState(false)

	const onChange = useCallback(
		(e: React.FormEvent<HTMLInputElement>) => {
			const raw = e.currentTarget.value
			const parsedValue = parseFloat(raw)
			if (isNaN(parsedValue)) {
				// keep the temporary string while editing but don't send NaN upstream
				setTmpValue(raw)
			} else {
				setTmpValue(parsedValue)
				setValue(parsedValue)
			}
		},
		[setValue]
	)

	// Compute whether we should visually show -∞ or ∞.
	const numericEffective = Number(tmpValue ?? value ?? 0)
	let showOverlayValue: string | null = null
	if (
		!!showMinAsNegativeInfinity &&
		typeof min !== 'undefined' &&
		!isNaN(numericEffective) &&
		numericEffective <= min
	) {
		showOverlayValue = '-∞'
	} else if (!!showMaxAsInfinity && typeof max !== 'undefined' && !isNaN(numericEffective) && numericEffective >= max) {
		showOverlayValue = '∞'
	}

	const input = (
		<div style={{ position: 'relative' }}>
			<CFormInput
				type="number"
				disabled={disabled}
				value={tmpValue ?? value ?? 0}
				min={min}
				max={max}
				step={step ?? 'any'}
				style={{
					color: !!checkValid && !checkValid(Number(tmpValue ?? value)) ? 'red' : undefined,
					// hide the underlying number when we show the -∞ or ∞ overlay and the field is not focused
					...(showOverlayValue && !focused ? { color: 'transparent', textShadow: '0 0 0 transparent' } : {}),
				}}
				title={tooltip}
				onChange={onChange}
				onFocus={() => {
					setFocused(true)
					setTmpValue(value ?? '')
				}}
				onBlur={() => {
					setFocused(false)
					setTmpValue(null)
				}}
			/>
			{!!showOverlayValue && !focused ? (
				<span
					className="number-input-inf-overlay"
					style={{ color: !!checkValid && !checkValid(Number(tmpValue ?? value)) ? 'red' : undefined }}
				>
					{showOverlayValue}
				</span>
			) : null}
		</div>
	)

	if (range) {
		return (
			<CRow>
				<CCol sm={12}>{input}</CCol>
				<CCol sm={12}>
					<CFormRange
						disabled={disabled}
						value={tmpValue ?? value ?? 0}
						min={min}
						max={max}
						step={step}
						title={tooltip}
						onChange={onChange}
						onFocus={() => setTmpValue(value ?? '')}
						onBlur={() => setTmpValue(null)}
					/>
				</CCol>
			</CRow>
		)
	} else {
		return input
	}
}
