import React, { useEffect, useCallback, useState } from 'react'
import { CCol, CFormInput, CFormRange, CRow } from '@coreui/react'

interface NumberInputFieldProps {
	label?: React.ReactNode
	required?: boolean
	min?: number
	max?: number
	step?: number
	tooltip?: string
	range?: boolean
	value: number
	setValue: (value: number) => void
	setValid?: (valid: boolean) => void
	disabled?: boolean
}

export function NumberInputField({
	label,
	required,
	min,
	max,
	step,
	tooltip,
	range,
	value,
	setValue,
	setValid,
	disabled,
}: NumberInputFieldProps): React.JSX.Element {
	const [tmpValue, setTmpValue] = useState<string | number | null>(null)

	// Check if the value is valid
	const isValueValid = useCallback(
		(val: string | number) => {
			if (val === '') {
				// If required, it must not be empty
				if (required) {
					return false
				}
			} else {
				const valNum = Number(val)
				// If has a value, it must be a number
				if (isNaN(valNum)) {
					return false
				}

				// Verify the value range
				if (min !== undefined && valNum < min) {
					return false
				}
				if (max !== undefined && valNum > max) {
					return false
				}
			}

			return true
		},
		[required, min, max]
	)

	// If the value is undefined, populate with the default. Also inform the parent about the validity
	useEffect(() => {
		setValid?.(isValueValid(value))
	}, [isValueValid, value, setValid])

	const onChange = useCallback(
		(e: React.FormEvent<HTMLInputElement>) => {
			const parsedValue = parseFloat(e.currentTarget.value)
			const processedValue = isNaN(parsedValue) ? e.currentTarget.value : parsedValue
			setTmpValue(processedValue)
			setValue(Number(processedValue))
			setValid?.(isValueValid(processedValue))
		},
		[setValue, setValid, isValueValid]
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
			style={{ color: !isValueValid(tmpValue ?? value) ? 'red' : undefined }}
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
