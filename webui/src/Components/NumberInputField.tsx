import React, { useCallback, useState } from 'react'
import { CCol, CFormInput, CFormRange, CRow } from '@coreui/react'

interface NumberInputFieldProps {
	label?: React.ReactNode
	min?: number
	max?: number
	step?: number
	tooltip?: string
	range?: boolean
	value: number
	setValue: (value: number) => void
	disabled?: boolean
	checkValid?: (value: number) => boolean
}

export function NumberInputField({
	label,
	min,
	max,
	step,
	tooltip,
	range,
	value,
	setValue,
	disabled,
	checkValid,
}: NumberInputFieldProps): React.JSX.Element {
	const [tmpValue, setTmpValue] = useState<string | number | null>(null)

	const onChange = useCallback(
		(e: React.FormEvent<HTMLInputElement>) => {
			const parsedValue = parseFloat(e.currentTarget.value)
			const processedValue = isNaN(parsedValue) ? e.currentTarget.value : parsedValue
			setTmpValue(processedValue)
			setValue(Number(processedValue))
		},
		[setValue]
	)

	// Render the input
	const input = (
		<CFormInput
			label={label}
			type="number"
			disabled={disabled}
			value={tmpValue ?? value ?? 0}
			min={min}
			max={max}
			step={step ?? 'any'}
			style={{ color: !!checkValid && !checkValid(Number(tmpValue ?? value)) ? 'red' : undefined }}
			title={tooltip}
			onChange={onChange}
			onFocus={() => setTmpValue(value ?? '')}
			onBlur={() => setTmpValue(null)}
		/>
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
